package com.barbuddy.shared.security;

import com.barbuddy.shared.errors.ApiProblemWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http, AuthProperties authProperties, ApiProblemWriter problems)
      throws Exception {
    AuthenticationEntryPoint authenticationEntryPoint =
        (request, response, exception) -> {
          new BearerTokenAuthenticationEntryPoint().commence(request, response, exception);
          problems.write(request, response, HttpStatus.UNAUTHORIZED, "Authentication is required.");
        };
    AccessDeniedHandler accessDeniedHandler =
        (request, response, exception) -> {
          new BearerTokenAccessDeniedHandler().handle(request, response, exception);
          problems.write(request, response, HttpStatus.FORBIDDEN, "Access is denied.");
        };

    http.authorizeHttpRequests(
            authorize ->
                authorize
                    .requestMatchers(HttpMethod.GET, "/actuator/health")
                    .permitAll()
                    .requestMatchers("/api/v1/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(AbstractHttpConfigurer::disable)
        .requestCache(cache -> cache.disable())
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .exceptionHandling(
            exceptions ->
                exceptions
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler));

    if (authProperties.enabled()) {
      http.oauth2ResourceServer(
          resourceServer ->
              resourceServer
                  .jwt(Customizer.withDefaults())
                  .authenticationEntryPoint(authenticationEntryPoint)
                  .accessDeniedHandler(accessDeniedHandler));
    }

    return http.build();
  }
}
