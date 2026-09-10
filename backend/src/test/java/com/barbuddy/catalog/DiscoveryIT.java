package com.barbuddy.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.home.HomeService;
import jakarta.persistence.EntityManagerFactory;
import java.nio.file.Path;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(
    properties = {
      "spring.config.import=",
      "spring.jpa.properties.hibernate.generate_statistics=true"
    })
@AutoConfigureMockMvc
@Testcontainers
class DiscoveryIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService catalog;
  @Autowired HomeService home;
  @Autowired EntityManagerFactory entityManagerFactory;

  @BeforeEach
  void load() throws Exception {
    jdbc.execute(
        "truncate user_cocktail_state, inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    importer.importCatalog(CatalogInput.read(Path.of("catalog/cocktails.json")));
  }

  @Test
  void randomUsesAllFiltersAndCurrentUserWithoutFallback() throws Exception {
    var negroni = catalog.cocktails("negroni", null, null, false, "one").getFirst();
    favorite("one", negroni.id());
    for (var ingredient : negroni.availability().missingIngredients().subList(0, 2)) {
      stock(ingredient.id(), "Have");
    }
    for (int attempt = 0; attempt < 10; attempt++) {
      mvc.perform(
              get("/api/v1/cocktails/random")
                  .with(jwt().jwt(j -> j.subject("one")))
                  .param("search", "NÉGRONI")
                  .param("primarySpiritId", negroni.primarySpirit().id().toString())
                  .param("availability", "one_away")
                  .param("favoritesOnly", "true"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.id").value(negroni.id().toString()))
          .andExpect(jsonPath("$.favorite").value(true))
          .andExpect(jsonPath("$.availability.missingCount").value(1));
    }
    for (String subject : new String[] {"one", "two"}) {
      mvc.perform(
              get("/api/v1/cocktails/random")
                  .with(jwt().jwt(j -> j.subject(subject)))
                  .param("availability", "can_make")
                  .param("favoritesOnly", "true"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("status").value(404));
    }
    mvc.perform(get("/api/v1/cocktails/random").with(jwt()).param("search", "no such cocktail"))
        .andExpect(status().isNotFound());
    var eligible =
        catalog.cocktails(null, null, null, false, "one").stream().map(c -> c.id()).toList();
    for (int attempt = 0; attempt < 20; attempt++) {
      assertThat(catalog.randomCocktail(null, null, null, false, "one").id()).isIn(eligible);
    }
  }

  @Test
  void summaryCountsDistinctHaveIngredientsAndRefreshesFromOwnedRecords() throws Exception {
    var negroni = catalog.cocktails("negroni", null, null, false, "one").getFirst();
    favorite("one", negroni.id());
    for (var ingredient : negroni.availability().missingIngredients())
      stock(ingredient.id(), "Have");
    stock(negroni.availability().missingIngredients().getFirst().id(), "Have");
    stock(negroni.availability().missingIngredients().getFirst().id(), "Out");
    var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();
    var summary = home.summary("one");
    assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(6);
    assertThat(summary.haveItems()).isEqualTo(4);
    assertThat(summary.outItems()).isEqualTo(1);
    assertThat(summary.availableIngredients()).isEqualTo(3);
    assertThat(summary.favorites()).isEqualTo(1);
    assertThat(summary.canMake()).isPositive();
    assertThat(summary.canMake())
        .isEqualTo(catalog.cocktails(null, null, "can_make", false, "one").size());
    assertThat(summary.oneAway())
        .isEqualTo(catalog.cocktails(null, null, "one_away", false, "one").size());
    mvc.perform(get("/api/v1/home").with(jwt().jwt(j -> j.subject("two"))).param("subject", "one"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.haveItems").value(0))
        .andExpect(jsonPath("$.outItems").value(0))
        .andExpect(jsonPath("$.availableIngredients").value(0))
        .andExpect(jsonPath("$.favorites").value(0))
        .andExpect(jsonPath("$.canMake").value(0));
    jdbc.update("update inventory_item set status = 'Out'");
    assertThat(home.summary("one").canMake()).isZero();
    assertThat(home.summary("one").availableIngredients()).isZero();
    mvc.perform(get("/api/v1/home").with(jwt().jwt(j -> j.subject("one"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.haveItems").value(0))
        .andExpect(jsonPath("$.outItems").value(5));
  }

  @Test
  void discoveryRequiresAuthenticationAndValidFiltersAndHandlesEmptyCatalog() throws Exception {
    mvc.perform(get("/api/v1/home")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/cocktails/random")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/cocktails/random").with(jwt()).param("availability", "bad"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/v1/cocktails/random")
                .with(jwt())
                .param("primarySpiritId", UUID.randomUUID().toString()))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/cocktails/random").with(jwt()).param("search", "a".repeat(201)))
        .andExpect(status().isBadRequest());
    jdbc.execute(
        "truncate user_cocktail_state, inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    mvc.perform(get("/api/v1/cocktails/random").with(jwt())).andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/home").with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canMake").value(0))
        .andExpect(jsonPath("$.oneAway").value(0));
  }

  private void favorite(String subject, UUID cocktail) throws Exception {
    mvc.perform(
            put("/api/v1/cocktails/" + cocktail + "/preference")
                .with(jwt().jwt(j -> j.subject(subject)))
                .contentType("application/json")
                .content("{\"favorite\":true}"))
        .andExpect(status().isOk());
  }

  private void stock(UUID ingredient, String status) {
    jdbc.update(
        "insert into inventory_item values (?, (select id from app_user where auth_subject = 'one'), ?, null, ?)",
        UUID.randomUUID(),
        ingredient,
        status);
  }
}
