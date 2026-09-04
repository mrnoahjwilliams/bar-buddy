package com.barbuddy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    properties = {
      "spring.config.import=",
      "springdoc.api-docs.enabled=true",
      "springdoc.paths-to-match=/api/v1/**",
      "springdoc.writer-with-order-by-keys=true",
      "springdoc.writer-with-default-pretty-printer=true",
      "springdoc.disable-i18n=true"
    })
// This test reads the schema in-process; runtime security remains unchanged.
@AutoConfigureMockMvc(addFilters = false)
@Testcontainers
class OpenApiGenerationIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11-alpine");

  @Autowired MockMvc mvc;

  @Test
  void exportsTheApplicationContract() throws Exception {
    var response =
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var schema = new JsonMapper().readTree(response);
    assertThat(schema.path("openapi").asString()).startsWith("3.1.");
    assertThat(schema.path("info").path("title").asString()).isEqualTo("Bar Buddy API");
    assertThat(schema.path("servers").get(0).path("url").asString()).isEqualTo("/");
    assertThat(schema.path("paths").isObject()).isTrue();
    assertThat(schema.path("paths").has("/actuator/health")).isFalse();
    var me = schema.path("paths").path("/api/v1/me").path("get");
    assertThat(me.path("operationId").asString()).isEqualTo("getCurrentUser");
    assertThat(me.path("security").get(0).has("bearerAuth")).isTrue();
    assertThat(
            me.path("responses")
                .path("200")
                .path("content")
                .path("application/json")
                .path("schema")
                .path("$ref")
                .asString())
        .isEqualTo("#/components/schemas/MeResponse");
    assertThat(
            me.path("responses")
                .path("401")
                .path("content")
                .path("application/problem+json")
                .path("schema")
                .path("$ref")
                .asString())
        .isEqualTo("#/components/schemas/ApiProblemResponse");
    assertThat(
            schema
                .path("components")
                .path("securitySchemes")
                .path("bearerAuth")
                .path("scheme")
                .asString())
        .isEqualTo("bearer");

    var output = Path.of("target/openapi/openapi.json");
    Files.createDirectories(output.getParent());
    Files.writeString(output, response.stripTrailing() + "\n");
  }
}
