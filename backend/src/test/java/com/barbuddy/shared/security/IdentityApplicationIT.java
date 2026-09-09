package com.barbuddy.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import org.springframework.http.MediaType;
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

@SpringBootTest(
    properties = {"spring.config.import=", "bar-buddy.account-deletion.worker-enabled=false"})
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

  @org.springframework.test.context.bean.override.convention.TestBean(methodName = "fakeAdmin")
  com.barbuddy.users.AuthAccountAdmin authAdmin;

  static FakeAdmin fakeAdmin() {
    return new FakeAdmin();
  }

  static class FakeAdmin extends com.barbuddy.users.AuthAccountAdmin {
    boolean enabled;
    boolean fail;

    FakeAdmin() {
      super(new AuthProperties(false, "https://auth.test", "", ""), "");
    }

    @Override
    public boolean available() {
      return enabled;
    }

    @Override
    public void delete(String subject) {
      if (fail) {
        fail = false;
        throw new IllegalStateException("temporary failure");
      }
    }
  }

  @Autowired com.barbuddy.users.AccountDeletionService deletions;
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
    ((FakeAdmin) authAdmin).enabled = false;
    ((FakeAdmin) authAdmin).fail = false;
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
  void profilePersistsNormalizesClearsAndCannotChangeAnotherUser() throws Exception {
    var first = token(SIGNING_RSA_KEY, "profile-first", ISSUER, "authenticated", future());
    var second = token(SIGNING_RSA_KEY, "profile-second", ISSUER, "authenticated", future());
    var otherId = getMe(second).get("id");
    mvc.perform(
            put("/api/v1/me?userId=" + otherId)
                .header("Authorization", "Bearer " + first)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    new JsonMapper()
                        .writeValueAsString(
                            Map.of("displayName", "  Noë Williams  ", "id", otherId))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Noë Williams"));
    assertThat(getMe(first).get("displayName")).isEqualTo("Noë Williams");
    assertThat(getMe(second).get("displayName")).isNull();
    mvc.perform(
            put("/api/v1/me")
                .header("Authorization", "Bearer " + first)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"  \"}"))
        .andExpect(status().isOk());
    assertThat(getMe(first).get("displayName")).isNull();
  }

  @Test
  void profileRejectsInvalidFieldsAndUnauthenticatedWrites() throws Exception {
    var accessToken =
        token(SIGNING_RSA_KEY, "profile-validation", ISSUER, "authenticated", future());
    for (String body :
        List.of(
            "{}",
            "{\"displayName\":null}",
            "{\"displayName\":\"" + "a".repeat(81) + "\"}",
            "{\"displayName\":\"line\\nline\"}")) {
      mvc.perform(
              put("/api/v1/me")
                  .header("Authorization", "Bearer " + accessToken)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }
    mvc.perform(
            put("/api/v1/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Someone\"}"))
        .andExpect(status().isUnauthorized());
    assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isZero();
  }

  @Test
  void deletionRemovesPrivateDataBlocksOldTokensAndRetriesIdentityRemoval() throws Exception {
    ((FakeAdmin) authAdmin).enabled = true;
    var subject = UUID.randomUUID().toString();
    var accessToken = token(SIGNING_RSA_KEY, subject, ISSUER, "authenticated", future());
    var owner = UUID.fromString((String) getMe(accessToken).get("id"));
    var second =
        token(SIGNING_RSA_KEY, UUID.randomUUID().toString(), ISSUER, "authenticated", future());
    var otherOwner = UUID.fromString((String) getMe(second).get("id"));
    jdbc.update(
        "insert into ingredient(id, catalog_id, name, category) values (?, 'ingredient:delete-test', 'Delete test', 'spirit')",
        owner);
    jdbc.update(
        "insert into cocktail(id, catalog_id, slug, name) values (?, 'cocktail:delete-test', 'delete-test', 'Delete test')",
        owner);
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
        owner,
        owner,
        owner);
    jdbc.update(
        "insert into user_cocktail_state(id, owner_user_id, cocktail_id, favorite) values (?, ?, ?, true)",
        owner,
        owner,
        owner);
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
        otherOwner,
        otherOwner,
        owner);
    jdbc.update(
        "insert into user_cocktail_state(id, owner_user_id, cocktail_id, favorite) values (?, ?, ?, true)",
        otherOwner,
        otherOwner,
        owner);
    mvc.perform(
            delete("/api/v1/me")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirmation\":\"no\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            delete("/api/v1/me")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirmation\":\"DELETE\"}"))
        .andExpect(status().isAccepted());
    assertThat(jdbc.queryForObject("select count(*) from inventory_item", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from user_cocktail_state", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from cocktail", Integer.class)).isEqualTo(1);
    for (String path :
        List.of("/api/v1/me", "/api/v1/home", "/api/v1/inventory", "/api/v1/cocktails"))
      mvc.perform(get(path).header("Authorization", "Bearer " + accessToken))
          .andExpect(status().isUnauthorized());
    getMe(second);
    mvc.perform(delete("/api/v1/me").header("Authorization", "Bearer " + accessToken))
        .andExpect(status().isAccepted());
    ((FakeAdmin) authAdmin).fail = true;
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> deletions.finish(subject))
        .isInstanceOf(IllegalStateException.class);
    assertThat(deletions.pending()).contains(subject);
    deletions.finish(subject);
    assertThat(deletions.pending()).doesNotContain(subject);
    assertThat(deletions.requested(subject)).isTrue();
    mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + accessToken))
        .andExpect(status().isUnauthorized());
    jdbc.update("delete from inventory_item");
    jdbc.update("delete from user_cocktail_state");
    jdbc.update("delete from cocktail");
    jdbc.update("delete from ingredient");
  }

  @Test
  void deletionRollsBackPrivateDataWhenTheDatabaseRejectsTheMarker() throws Exception {
    ((FakeAdmin) authAdmin).enabled = true;
    String subject = UUID.randomUUID().toString();
    var accessToken = token(SIGNING_RSA_KEY, subject, ISSUER, "authenticated", future());
    var owner = UUID.fromString((String) getMe(accessToken).get("id"));
    jdbc.update(
        "insert into ingredient(id, catalog_id, name, category) values (?, 'ingredient:rollback-test', 'Rollback test', 'spirit')",
        owner);
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
        owner,
        owner,
        owner);
    jdbc.execute(
        "alter table app_user add constraint test_reject_deletion check (deletion_requested_at is null)");
    try {
      org.assertj.core.api.Assertions.assertThatThrownBy(() -> deletions.request(subject))
          .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      assertThat(
              jdbc.queryForObject(
                  "select count(*) from inventory_item where owner_user_id = ?",
                  Integer.class,
                  owner))
          .isEqualTo(1);
      assertThat(deletions.requested(subject)).isFalse();
      getMe(accessToken);
    } finally {
      jdbc.execute("alter table app_user drop constraint test_reject_deletion");
      jdbc.update("delete from inventory_item");
      jdbc.update("delete from ingredient");
    }
  }

  @Test
  void unavailableDeletionPreservesAnAccount() throws Exception {
    var token =
        token(SIGNING_RSA_KEY, UUID.randomUUID().toString(), ISSUER, "authenticated", future());
    var before = getMe(token);
    mvc.perform(
            delete("/api/v1/me")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirmation\":\"DELETE\"}"))
        .andExpect(status().isServiceUnavailable());
    assertThat(getMe(token)).isEqualTo(before);
    mvc.perform(
            delete("/api/v1/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirmation\":\"DELETE\"}"))
        .andExpect(status().isUnauthorized());
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
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(jsonPath("$.detail").value("Authentication is required."));
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
