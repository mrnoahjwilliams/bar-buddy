package com.barbuddy.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = "spring.config.import=")
@AutoConfigureMockMvc
@Testcontainers
class IdentityApplicationIT {
  private static final String ISSUER = "https://bar-buddy.test/auth/v1";
  private static final RSAKey SIGNING_RSA_KEY = createRsaKey("bar-buddy-rsa-test");
  private static final ECKey SIGNING_EC_KEY = createEcKey("bar-buddy-ec-test");
  private static final RSAKey OTHER_KEY = createRsaKey("other-test");
  private static final HttpServer JWKS_SERVER = startJwksServer();

  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11-alpine");

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;

  @DynamicPropertySource
  static void authProperties(DynamicPropertyRegistry registry) {
    registry.add("bar-buddy.auth.enabled", () -> true);
    registry.add("bar-buddy.auth.issuer", () -> ISSUER);
    registry.add(
        "bar-buddy.auth.jwk-set-uri",
        () -> "http://127.0.0.1:" + JWKS_SERVER.getAddress().getPort() + "/jwks");
    registry.add("bar-buddy.auth.audience", () -> "authenticated");
  }

  @BeforeEach
  void clearUsers() {
    jdbc.update("delete from app_user");
  }

  @AfterAll
  static void stopJwksServer() {
    JWKS_SERVER.stop(0);
  }

  @Test
  void validTokensResolveStableIsolatedUsersAndIgnoreClientOwnership() throws Exception {
    var firstSubject = UUID.randomUUID().toString();
    var secondSubject = UUID.randomUUID().toString();

    var first = getMe(token(SIGNING_EC_KEY, firstSubject, ISSUER, "authenticated", future()));
    var repeated =
        getMe(
            token(SIGNING_RSA_KEY, firstSubject, ISSUER, "authenticated", future()),
            "?userId=" + secondSubject);
    var second = getMe(token(SIGNING_EC_KEY, secondSubject, ISSUER, "authenticated", future()));

    assertThat(repeated).isEqualTo(first);
    assertThat(second.get("id")).isNotEqualTo(first.get("id"));
    assertThat(first).containsKeys("id", "createdAt").doesNotContainKey("authSubject");
    assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isEqualTo(2);
  }

  @Test
  void concurrentFirstAccessCreatesOneLocalIdentity() throws Exception {
    var subject = UUID.randomUUID().toString();
    var accessToken = token(SIGNING_RSA_KEY, subject, ISSUER, "authenticated", future());
    var calls = new ArrayList<Callable<Map<String, Object>>>();
    for (int index = 0; index < 8; index++) {
      calls.add(() -> getMe(accessToken));
    }

    List<Map<String, Object>> responses;
    try (var executor = Executors.newFixedThreadPool(calls.size())) {
      responses = executor.invokeAll(calls).stream().map(this::completed).toList();
    }

    assertThat(responses)
        .extracting(response -> response.get("id"))
        .containsOnly(responses.getFirst().get("id"));
    assertThat(
            jdbc.queryForObject(
                "select count(*) from app_user where auth_subject = ?", Integer.class, subject))
        .isEqualTo(1);
  }

  @Test
  void rejectsMissingMalformedInvalidExpiredAndMisdirectedTokens() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/me").header("Authorization", "Bearer not-a-jwt"))
        .andExpect(status().isUnauthorized());
    expectUnauthorized(
        token(OTHER_KEY, UUID.randomUUID().toString(), ISSUER, "authenticated", future()));
    expectUnauthorized(
        token(SIGNING_RSA_KEY, UUID.randomUUID().toString(), ISSUER, "authenticated", past()));
    expectUnauthorized(
        token(
            SIGNING_RSA_KEY,
            UUID.randomUUID().toString(),
            "https://other.test/auth/v1",
            "authenticated",
            future()));
    expectUnauthorized(
        token(SIGNING_RSA_KEY, UUID.randomUUID().toString(), ISSUER, "other", future()));
    expectUnauthorized(token(SIGNING_RSA_KEY, " ", ISSUER, "authenticated", future()));

    assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isZero();
  }

  private Map<String, Object> getMe(String accessToken) throws Exception {
    return getMe(accessToken, "");
  }

  private Map<String, Object> getMe(String accessToken, String query) throws Exception {
    var body =
        mvc.perform(get("/api/v1/me" + query).header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return new JsonMapper().readValue(body, new TypeReference<Map<String, Object>>() {});
  }

  private void expectUnauthorized(String accessToken) throws Exception {
    mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + accessToken))
        .andExpect(status().isUnauthorized());
  }

  private Map<String, Object> completed(java.util.concurrent.Future<Map<String, Object>> future) {
    try {
      return future.get();
    } catch (Exception exception) {
      throw new AssertionError(exception);
    }
  }

  private static String token(
      JWK key, String subject, String issuer, String audience, Instant expiresAt) {
    JwtEncoder encoder =
        new NimbusJwtEncoder(new ImmutableJWKSet<SecurityContext>(new JWKSet(key)));
    var algorithm = key instanceof ECKey ? SignatureAlgorithm.ES256 : SignatureAlgorithm.RS256;
    var now = Instant.now();
    var issuedAt =
        expiresAt.isBefore(now)
            ? expiresAt.minus(10, ChronoUnit.MINUTES)
            : now.minus(2, ChronoUnit.MINUTES);
    var claims =
        JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(subject)
            .audience(List.of(audience))
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .build();
    return encoder
        .encode(
            JwtEncoderParameters.from(
                JwsHeader.with(algorithm).keyId(key.getKeyID()).build(), claims))
        .getTokenValue();
  }

  private static Instant future() {
    return Instant.now().plus(10, ChronoUnit.MINUTES);
  }

  private static Instant past() {
    return Instant.now().minus(5, ChronoUnit.MINUTES);
  }

  private static RSAKey createRsaKey(String keyId) {
    try {
      return new RSAKeyGenerator(2048).keyID(keyId).generate();
    } catch (Exception exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static ECKey createEcKey(String keyId) {
    try {
      return new ECKeyGenerator(Curve.P_256).keyID(keyId).generate();
    } catch (Exception exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static HttpServer startJwksServer() {
    try {
      var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
      var jwks =
          new JWKSet(List.of(SIGNING_RSA_KEY.toPublicJWK(), SIGNING_EC_KEY.toPublicJWK()))
              .toString()
              .getBytes(StandardCharsets.UTF_8);
      server.createContext(
          "/jwks",
          exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jwks.length);
            exchange.getResponseBody().write(jwks);
            exchange.close();
          });
      server.start();
      return server;
    } catch (IOException exception) {
      throw new IllegalStateException(exception);
    }
  }
}
