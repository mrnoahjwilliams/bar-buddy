package com.barbuddy.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.catalog.CatalogResponses.CocktailSummary;
import jakarta.persistence.EntityManagerFactory;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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
class CatalogDiscoveryIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService catalog;
  @Autowired JdbcTemplate jdbc;
  @Autowired MockMvc mvc;
  @Autowired EntityManagerFactory emf;

  @BeforeEach
  void load() throws Exception {
    jdbc.execute(
        "truncate user_cocktail_state, inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    importer.importCatalog(CatalogInput.read(Path.of("catalog/cocktails.json")));
  }

  @Test
  void metadataAliasesAndMocktailsAreExplicitAndComposeWithoutDuplicates() throws Exception {
    var mocktails = list(null, null, "alcohol_free", null);
    assertThat(mocktails)
        .extracting(CocktailSummary::name)
        .containsExactlyInAnyOrder("Virgin Mojito", "Shirley Temple", "Arnold Palmer");
    assertThat(mocktails).extracting(CocktailSummary::alcoholFree).containsOnly(true);
    assertThat(list(null, null, "alcoholic", null)).hasSize(102);
    var americano = catalog.cocktails("americano", null, null, null, false, "one").getFirst();
    assertThat(americano.primarySpirit()).isNull();
    assertThat(americano.alcoholFree()).isFalse();
    assertThat(americano.styles()).contains("negroni", "highball");
    assertThat(list("negroni", "aperitif", "alcoholic", null))
        .extracting(CocktailSummary::id)
        .contains(americano.id());
    assertThat(list("highball", "summer", "alcohol_free", null))
        .extracting(CocktailSummary::name)
        .containsExactly("Virgin Mojito");
    assertThat(list("sour", null, "alcohol_free", null)).isEmpty();
    var alias = catalog.cocktails("NOJÍTO", null, null, null, false, "one").getFirst();
    assertThat(alias.name()).isEqualTo("Virgin Mojito");
    assertThat(alias.matchedAlias()).isEqualTo("Nojito");
    assertThat(
            catalog.cocktails("virgin", null, null, null, false, "one").getFirst().matchedAlias())
        .isNull();
    assertThat(catalog.ingredients("OJ", "juice"))
        .extracting(CatalogResponses.IngredientSummary::name)
        .containsExactly("Orange juice");
    assertThat(catalog.cocktails("%", null, null, null, false, "one")).isEmpty();
    assertThat(list(null, null, null, null)).anyMatch(c -> c.styles().isEmpty());
    jdbc.update("update cocktail set alcohol_free = null where id = ?", alias.id());
    assertThat(list(null, null, "alcohol_free", null)).hasSize(2);
    assertThat(list(null, null, "alcoholic", null)).hasSize(102);
    assertThat(list(null, null, "all", null)).hasSize(105);
    mvc.perform(get("/api/v1/cocktails/" + americano.id()).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("alcoholFree").value(false))
        .andExpect(jsonPath("styles[0]").value("negroni"));
  }

  @Test
  void allFiltersAndRandomRemainOwnerScopedAndReflectStockChanges() throws Exception {
    var drink = list("highball", "summer", "alcohol_free", null).getFirst();
    var ingredient = drink.availability().missingIngredients().getFirst();
    UUID owner = UUID.randomUUID();
    jdbc.update("insert into app_user(id, auth_subject) values (?, 'one')", owner);
    jdbc.update(
        "insert into user_cocktail_state(id, owner_user_id, cocktail_id, favorite) values (?, ?, ?, true)",
        UUID.randomUUID(),
        owner,
        drink.id());
    for (var missing :
        drink.availability().missingIngredients().subList(1, drink.ingredientCount())) {
      jdbc.update(
          "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
          UUID.randomUUID(),
          owner,
          missing.id());
    }
    // One depleted bottle cannot satisfy the final requirement.
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Out')",
        UUID.randomUUID(),
        owner,
        ingredient.id());
    var options = new CatalogDiscovery("highball", "summer", "alcohol_free", "ingredient_count");
    assertThat(catalog.cocktails("nojito", null, ingredient.id(), "one_away", true, options, "one"))
        .hasSize(1);
    assertThat(catalog.cocktails("nojito", null, ingredient.id(), "one_away", true, options, "two"))
        .isEmpty();
    for (int i = 0; i < 4; i++) {
      mvc.perform(
              get("/api/v1/cocktails/random")
                  .with(jwt().jwt(j -> j.subject("one")))
                  .param("search", "nojito")
                  .param("ingredientId", ingredient.id().toString())
                  .param("style", "highball")
                  .param("tag", "summer")
                  .param("alcohol", "alcohol_free")
                  .param("sort", "ingredient_count")
                  .param("availability", "one_away")
                  .param("favoritesOnly", "true"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("id").value(drink.id().toString()))
          .andExpect(jsonPath("discoveryVersion").value(1));
    }
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
        UUID.randomUUID(),
        owner,
        ingredient.id());
    assertThat(catalog.cocktails(null, null, null, "can_make", true, options, "one")).hasSize(1);
    assertThat(catalog.cocktails(null, null, null, "can_make", false, options, "two")).isEmpty();
    assertThat(
            catalog.cocktails(
                null,
                catalog.ingredients("gin", "spirit").stream()
                    .filter(i -> i.name().equals("Gin"))
                    .findFirst()
                    .orElseThrow()
                    .id(),
                null,
                null,
                false,
                options,
                "one"))
        .isEmpty();
    mvc.perform(
            get("/api/v1/cocktails/random")
                .with(jwt())
                .param("style", "sour")
                .param("alcohol", "alcohol_free"))
        .andExpect(status().isNotFound());
  }

  @Test
  void sortsCountDistinctRequiredIngredientsAndKeepAvailabilityBandsAndStableTies() {
    var virgin =
        list(null, null, "alcohol_free", null).stream()
            .filter(c -> c.name().equals("Virgin Mojito"))
            .findFirst()
            .orElseThrow();
    var recipe = catalog.cocktail(virgin.id(), "one").recipe();
    jdbc.update(
        "insert into recipe_ingredient select ?, recipe_id, ingredient_id, 99, recipe_display_name, requirement, preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and position = 1",
        UUID.randomUUID(),
        recipe.id());
    jdbc.update(
        "insert into recipe_ingredient select ?, recipe_id, ?, 100, 'Optional rum', 'optional', preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and position = 1",
        UUID.randomUUID(),
        catalog.ingredients("spiced rum", "spirit").getFirst().id(),
        recipe.id());
    assertThat(catalog.cocktail(virgin.id(), "one").ingredientCount()).isEqualTo(4);
    var owner = UUID.randomUUID();
    jdbc.update("insert into app_user(id, auth_subject) values (?, 'one')", owner);
    for (var ingredient :
        list(null, null, "alcohol_free", null).stream()
            .filter(c -> c.name().equals("Arnold Palmer"))
            .findFirst()
            .orElseThrow()
            .availability()
            .missingIngredients()) {
      jdbc.update(
          "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
          UUID.randomUUID(),
          owner,
          ingredient.id());
    }
    var shirley =
        list(null, null, "alcohol_free", null).stream()
            .filter(c -> c.name().equals("Shirley Temple"))
            .findFirst()
            .orElseThrow();
    jdbc.update(
        "insert into inventory_item(id, owner_user_id, ingredient_id, status) values (?, ?, ?, 'Have')",
        UUID.randomUUID(),
        owner,
        shirley.availability().missingIngredients().getFirst().id());
    Comparator<CocktailSummary> names =
        Comparator.comparing((CocktailSummary c) -> c.name().toLowerCase(Locale.ROOT))
            .thenComparing(CocktailSummary::id);
    for (String sort : List.of("availability", "alphabetical", "ingredient_count")) {
      var result = list(null, null, null, sort);
      assertThat(result)
          .extracting(
              c ->
                  sort.equals("availability")
                      ? c.availability().missingCount()
                      : Math.min(2, c.availability().missingCount()))
          .isSorted();
      for (int band = 0; band <= 2; band++) {
        int current = band;
        var group =
            result.stream()
                .filter(c -> Math.min(2, c.availability().missingCount()) == current)
                .toList();
        if (sort.equals("alphabetical")) assertThat(group).isSortedAccordingTo(names);
        if (sort.equals("ingredient_count"))
          assertThat(group)
              .isSortedAccordingTo(
                  Comparator.comparingInt(CocktailSummary::ingredientCount).thenComparing(names));
      }
      assertThat(result).isEqualTo(list(null, null, null, sort));
    }
    assertThat(list(null, null, "alcohol_free", "ingredient_count"))
        .extracting(CocktailSummary::name)
        .containsExactly("Arnold Palmer", "Shirley Temple", "Virgin Mojito");
  }

  @Test
  void validatesResetsAndKeepsQueriesBoundedAndProviderFunctionsPrivate() throws Exception {
    for (String endpoint : List.of("/api/v1/cocktails", "/api/v1/cocktails/random")) {
      for (String param : List.of("style", "tag", "alcohol", "sort")) {
        mvc.perform(get(endpoint).with(jwt()).param(param, "unknown"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("status").value(400));
        mvc.perform(get(endpoint).with(jwt()).param(param, " ")).andExpect(status().isOk());
      }
      mvc.perform(get(endpoint).param("alcohol", "alcohol_free"))
          .andExpect(status().isUnauthorized());
    }
    var stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    assertThat(list("highball", "summer", "alcohol_free", "ingredient_count")).hasSize(1);
    assertThat(stats.getPrepareStatementCount()).isEqualTo(3);
    for (String role : List.of("anon", "authenticated", "service_role")) {
      for (String function :
          List.of("catalog_alias_matches(text[],text)", "catalog_metadata_matches(text[],text)")) {
        assertThat(
                jdbc.queryForObject(
                    "select has_function_privilege(?, ?, 'EXECUTE')",
                    Boolean.class,
                    role,
                    function))
            .isFalse();
      }
    }
  }

  private List<CocktailSummary> list(String style, String tag, String alcohol, String sort) {
    return catalog.cocktails(
        null, null, null, null, false, new CatalogDiscovery(style, tag, alcohol, sort), "one");
  }
}
