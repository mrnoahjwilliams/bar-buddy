package com.barbuddy.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("bar-buddy.auth")
public record AuthProperties(boolean enabled, String issuer, String jwkSetUri, String audience) {}
