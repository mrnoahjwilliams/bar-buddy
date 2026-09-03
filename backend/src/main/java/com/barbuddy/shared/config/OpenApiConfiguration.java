package com.barbuddy.shared.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfiguration {
  @Bean
  OpenAPI barBuddyOpenApi() {
    return new OpenAPI()
        .info(new Info().title("Bar Buddy API").version("v1"))
        .addServersItem(new Server().url("/"));
  }
}
