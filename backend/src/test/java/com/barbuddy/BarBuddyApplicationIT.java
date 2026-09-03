package com.barbuddy;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class BarBuddyApplicationIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11-alpine");

  @Autowired DataSource dataSource;
  @Autowired Flyway flyway;
  @LocalServerPort int port;

  @Test
  void startsAgainstPostgresWithoutApplicationTables() throws Exception {
    var jdbc = new JdbcTemplate(dataSource);
    assertThat(jdbc.queryForObject("select version()", String.class)).startsWith("PostgreSQL 17.");
    assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
    assertThat(flyway.info().applied()).isEmpty();
    assertThat(
            jdbc.queryForList(
                """
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name <> 'flyway_schema_history'
        """,
                String.class))
        .isEmpty();

    try (var client = HttpClient.newHttpClient()) {
      var health =
          client.send(
              HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/actuator/health"))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertThat(health.statusCode()).isEqualTo(200);
      var healthBody = new JsonMapper().readValue(health.body(), Map.class);
      assertThat(healthBody.get("status")).isEqualTo("UP");
      assertThat(healthBody.containsKey("components")).isFalse();

      var denied =
          client.send(
              HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/me")).build(),
              HttpResponse.BodyHandlers.ofString());
      assertThat(denied.statusCode()).isEqualTo(401);
      assertThat(denied.headers().allValues("set-cookie")).isEmpty();
    }
  }
}
