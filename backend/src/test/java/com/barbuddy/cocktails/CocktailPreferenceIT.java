package com.barbuddy.cocktails;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.catalog.CatalogBrowseService;
import com.barbuddy.catalog.CatalogImportService;
import com.barbuddy.catalog.CatalogInput;
import java.nio.file.Path;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(properties = "spring.config.import=")
@AutoConfigureMockMvc
@Testcontainers
class CocktailPreferenceIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService catalog;

  @BeforeEach
  void load() throws Exception {
    jdbc.execute(
        "truncate user_cocktail_state, inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    importer.importCatalog(CatalogInput.read(Path.of("../catalog/cocktails.json")));
  }

  @Test
  void favoritesPersistRemainIsolatedAndCombineWithEveryDrinksFilter() throws Exception {
    var negroni = catalog.cocktails("negroni", null, null, false, "one").getFirst();
    var spirit = negroni.primarySpirit().id();

    favorite("one", negroni.id(), true);
    favorite("one", negroni.id(), true);
    for (var ingredient : negroni.availability().missingIngredients().subList(0, 2)) {
      jdbc.update(
          "insert into inventory_item values (?, (select id from app_user where auth_subject = 'one'), ?, null, 'Have')",
          UUID.randomUUID(),
          ingredient.id());
    }

    assertThat(catalog.cocktail(negroni.id(), "one").favorite()).isTrue();
    assertThat(catalog.cocktail(negroni.id(), "two").favorite()).isFalse();
    assertThat(catalog.cocktails("negroni", spirit, "one_away", true, "one"))
        .singleElement()
        .satisfies(
            favorite -> {
              assertThat(favorite.id()).isEqualTo(negroni.id());
              assertThat(favorite.favorite()).isTrue();
              assertThat(favorite.availability().missingCount()).isEqualTo(1);
            });
    assertThat(catalog.cocktails("negroni", spirit, "one_away", true, "two")).isEmpty();
    mvc.perform(
            get("/api/v1/cocktails")
                .with(jwt().jwt(j -> j.subject("one")))
                .param("search", "negroni")
                .param("primarySpiritId", spirit.toString())
                .param("availability", "one_away")
                .param("favoritesOnly", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].favorite").value(true));

    favorite("one", negroni.id(), false);
    favorite("one", negroni.id(), false);
    assertThat(catalog.cocktail(negroni.id(), "one").favorite()).isFalse();
    assertThat(catalog.cocktails("", null, null, true, "one")).isEmpty();
    assertThat(
            jdbc.queryForObject(
                "select count(*) from user_cocktail_state where cocktail_id = ?",
                Integer.class,
                negroni.id()))
        .isEqualTo(1);
  }

  @Test
  void preferenceRequiresAuthenticationAndValidInputAndIgnoresClientOwnership() throws Exception {
    var cocktail = catalog.cocktails("negroni", null, null, false, "one").getFirst().id();
    mvc.perform(
            put("/api/v1/cocktails/" + cocktail + "/preference")
                .contentType("application/json")
                .content("{\"favorite\":true}"))
        .andExpect(status().isUnauthorized());
    for (String input : new String[] {"{}", "null", "not json", "{\"favorite\":null}"}) {
      mvc.perform(
              put("/api/v1/cocktails/" + cocktail + "/preference")
                  .with(jwt())
                  .contentType("application/json")
                  .content(input))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("status").value(400));
    }
    mvc.perform(
            put("/api/v1/cocktails/" + UUID.randomUUID() + "/preference")
                .with(jwt())
                .contentType("application/json")
                .content("{\"favorite\":true}"))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/v1/cocktails/" + cocktail + "/preference")
                .with(jwt().jwt(j -> j.subject("owner")))
                .contentType("application/json")
                .content("{\"favorite\":true,\"ownerUserId\":\"" + UUID.randomUUID() + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("cocktailId").value(cocktail.toString()))
        .andExpect(jsonPath("favorite").value(true));
    assertThat(catalog.cocktail(cocktail, "owner").favorite()).isTrue();
    assertThat(catalog.cocktail(cocktail, "other").favorite()).isFalse();
  }

  @Test
  void migrationPreservesExistingRecordsAndRestrictsRowsAndProviderRoles() {
    var source =
        new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    Flyway.configure()
        .dataSource(source)
        .schemas("preference_upgrade")
        .defaultSchema("preference_upgrade")
        .target("4")
        .load()
        .migrate();
    var user = UUID.randomUUID();
    var ingredient = UUID.randomUUID();
    var cocktail = UUID.randomUUID();
    jdbc.update(
        "insert into preference_upgrade.app_user (id, auth_subject) values (?, 'existing')", user);
    jdbc.update(
        "insert into preference_upgrade.ingredient values (?, 'ingredient:existing', 'Existing', 'spirit', '{}')",
        ingredient);
    jdbc.update(
        "insert into preference_upgrade.cocktail values (?, 'cocktail:existing', 'existing', 'Existing', ?)",
        cocktail,
        ingredient);
    var upgrade =
        Flyway.configure()
            .dataSource(source)
            .schemas("preference_upgrade")
            .defaultSchema("preference_upgrade")
            .target("5")
            .load();
    assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(1);
    assertThat(upgrade.migrate().migrationsExecuted).isZero();
    assertThat(
            jdbc.queryForObject("select count(*) from preference_upgrade.cocktail", Integer.class))
        .isEqualTo(1);
    jdbc.update(
        "insert into preference_upgrade.user_cocktail_state values (?, ?, ?, true)",
        UUID.randomUUID(),
        user,
        cocktail);
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "insert into preference_upgrade.user_cocktail_state values (?, ?, ?, false)",
                    UUID.randomUUID(),
                    user,
                    cocktail))
        .isInstanceOf(DataIntegrityViolationException.class);
    for (String role : new String[] {"anon", "authenticated", "service_role"}) {
      for (String privilege :
          new String[] {
            "select", "insert", "update", "delete", "truncate", "references", "trigger"
          }) {
        assertThat(
                jdbc.queryForObject(
                    "select has_table_privilege(?, 'preference_upgrade.user_cocktail_state', ?)",
                    Boolean.class,
                    role,
                    privilege))
            .isFalse();
      }
    }
  }

  private void favorite(String subject, UUID cocktail, boolean favorite) throws Exception {
    mvc.perform(
            put("/api/v1/cocktails/" + cocktail + "/preference")
                .with(jwt().jwt(j -> j.subject(subject)))
                .contentType("application/json")
                .content("{\"favorite\":" + favorite + "}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("favorite").value(favorite));
  }
}
