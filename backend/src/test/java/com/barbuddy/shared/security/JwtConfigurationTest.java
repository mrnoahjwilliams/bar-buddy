package com.barbuddy.shared.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class JwtConfigurationTest {

  private final JwtConfiguration configuration = new JwtConfiguration();

  @Test
  void rejectsMissingMalformedAndInsecureAuthenticationSettings() {
    assertThatThrownBy(
            () ->
                configuration.jwtDecoder(
                    new AuthProperties(true, "", "https://example.com/jwks", "authenticated")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("AUTH_ISSUER is required");
    assertThatThrownBy(
            () ->
                configuration.jwtDecoder(
                    new AuthProperties(
                        true, "https://example.com/auth/v1", "not a URL", "authenticated")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("AUTH_JWK_SET_URI must be a valid URL");
    assertThatThrownBy(
            () ->
                configuration.jwtDecoder(
                    new AuthProperties(
                        true,
                        "https://example.com/auth/v1",
                        "http://example.com/jwks",
                        "authenticated")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("AUTH_JWK_SET_URI must use HTTPS");
    assertThatThrownBy(
            () ->
                configuration.jwtDecoder(
                    new AuthProperties(
                        true,
                        "https://YOUR_PROJECT_REF.supabase.co/auth/v1",
                        "https://YOUR_PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json",
                        "authenticated")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("example placeholder");
  }

  @Test
  void allowsLoopbackHttpForDisposableJwksServers() {
    configuration.jwtDecoder(
        new AuthProperties(
            true,
            "https://bar-buddy.test/auth/v1",
            "http://127.0.0.1:54321/jwks",
            "authenticated"));
  }
}
