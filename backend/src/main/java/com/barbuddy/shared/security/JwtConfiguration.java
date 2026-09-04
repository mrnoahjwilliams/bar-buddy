package com.barbuddy.shared.security;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.util.StringUtils;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AuthProperties.class)
public class JwtConfiguration {

  @Bean
  @ConditionalOnMissingBean(JwtDecoder.class)
  @ConditionalOnProperty(name = "bar-buddy.auth.enabled", havingValue = "true")
  JwtDecoder jwtDecoder(AuthProperties properties) {
    requireText(properties.issuer(), "AUTH_ISSUER");
    requireText(properties.jwkSetUri(), "AUTH_JWK_SET_URI");
    requireText(properties.audience(), "AUTH_AUDIENCE");

    var decoder =
        NimbusJwtDecoder.withJwkSetUri(properties.jwkSetUri())
            .jwsAlgorithms(
                trusted ->
                    trusted.addAll(List.of(SignatureAlgorithm.ES256, SignatureAlgorithm.RS256)))
            .build();
    OAuth2TokenValidator<Jwt> issuerAndTime =
        JwtValidators.createDefaultWithIssuer(properties.issuer());
    OAuth2TokenValidator<Jwt> audience =
        new JwtClaimValidator<List<String>>(
            "aud", claims -> claims != null && claims.contains(properties.audience()));
    OAuth2TokenValidator<Jwt> subject =
        new JwtClaimValidator<String>(
            "sub", claim -> StringUtils.hasText(claim) && claim.length() <= 255);
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerAndTime, audience, subject));
    return decoder;
  }

  private static void requireText(String value, String environmentName) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException(
          environmentName + " is required when authentication is enabled");
    }
  }
}
