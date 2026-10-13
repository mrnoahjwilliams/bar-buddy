package com.barbuddy.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class CatalogBrowseIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11-alpine");

  @Autowired MockMvc mvc;
  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService service;
  @Autowired JdbcTemplate jdbc;
  @Autowired EntityManagerFactory emf;

  @BeforeEach
  void load() throws Exception {
    jdbc.execute(
        "truncate user_cocktail_state, inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    importer.importCatalog(CatalogInput.read(Path.of("catalog/cocktails.json")));
  }

  @Test
  void combinesFiltersResetsAndTreatsSearchLiterally() throws Exception {
    var gin =
        service.ingredients("gin", "spirit").stream()
            .filter(i -> i.name().equals("Gin"))
            .findFirst()
            .orElseThrow();
    assertThat(service.ingredients("  GIN  ", "spirit")).contains(gin);
    assertThat(service.ingredients("", "")).hasSize(118);
    assertThat(service.ingredients("%", null)).isEmpty();
    assertThat(service.cocktails("", null, null, null, false, "user")).hasSize(105);
    assertThat(service.cocktails("negroni", gin.id(), null, null, false, "user")).hasSize(1);
    assertThat(service.cocktails("zzzz", gin.id(), null, null, false, "user")).isEmpty();
    mvc.perform(get("/api/v1/ingredients").with(jwt()).param("category", "unknown"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("status").value(400));
    mvc.perform(get("/api/v1/cocktails").with(jwt()).param("primarySpiritId", "bad"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/v1/cocktails")
                .with(jwt())
                .param("primarySpiritId", UUID.randomUUID().toString()))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/ingredients").with(jwt()).param("search", "x".repeat(201)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void relatedCocktailsStayDistinctAndOpenOrderedRecipeDetails() throws Exception {
    var drink = service.cocktails("negroni", null, null, null, false, "user").getFirst();
    var detail = service.cocktail(drink.id(), "user");
    var first = detail.recipe().ingredients().getFirst();
    jdbc.update(
        "insert into recipe_ingredient select ?, recipe_id, ingredient_id, 99, recipe_display_name, requirement, preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and position = ?",
        UUID.randomUUID(),
        detail.recipe().id(),
        first.position());
    var ingredient = service.ingredient(first.ingredient().id(), "user");
    assertThat(ingredient.relatedCocktails()).contains(drink);
    assertThat(ingredient.usageCount()).isEqualTo(ingredient.relatedCocktails().size());
    assertThat(ingredient.relatedCocktails())
        .extracting(CatalogResponses.CocktailSummary::id)
        .doesNotHaveDuplicates();
    mvc.perform(get("/api/v1/cocktails/" + drink.id()).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("recipe.glassware").isNotEmpty())
        .andExpect(jsonPath("recipe.instructions").isNotEmpty())
        .andExpect(jsonPath("recipe.ingredients[0].us.unit").isNotEmpty());
    assertThat(service.cocktail(drink.id(), "user").recipe().ingredients())
        .extracting(CatalogResponses.RecipeLine::position)
        .isSorted();
    mvc.perform(get("/api/v1/ingredients/" + ingredient.id()).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("usageCount").value(ingredient.usageCount()));
  }

  @Test
  void ingredientFilterMatchesAnyRecipeLineOnceAcrossRecipes() throws Exception {
    var negroni = service.cocktails("negroni", null, null, null, false, "one").getFirst();
    var recipe = service.cocktail(negroni.id(), "one").recipe();
    var campari = service.ingredients("campari", "liqueur").getFirst();
    var extraRecipe = UUID.randomUUID();
    jdbc.update(
        "insert into recipe select ?, 'recipe:negroni:test', cocktail_id, name, instructions, glassware, garnish from recipe where id = ?",
        extraRecipe,
        recipe.id());
    jdbc.update(
        "insert into recipe_ingredient select ?, ?, ingredient_id, 1, recipe_display_name, 'optional', preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and ingredient_id = ?",
        UUID.randomUUID(),
        extraRecipe,
        recipe.id(),
        campari.id());
    var stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    var matches = service.cocktails(null, null, campari.id(), null, false, "one");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(4);
    assertThat(matches).extracting(CatalogResponses.CocktailSummary::id).doesNotHaveDuplicates();
    assertThat(matches).extracting(CatalogResponses.CocktailSummary::id).contains(negroni.id());
    assertThat(matches)
        .extracting(CatalogResponses.CocktailSummary::matchedIngredientId)
        .containsOnly(campari.id());
    assertThat(matches)
        .extracting(CatalogResponses.CocktailSummary::id)
        .containsExactlyInAnyOrderElementsOf(
            service.ingredient(campari.id(), "one").relatedCocktails().stream()
                .map(CatalogResponses.CocktailSummary::id)
                .toList());
    assertThat(service.ingredient(campari.id(), "one").usageCount()).isEqualTo(matches.size());
    mvc.perform(
            get("/api/v1/cocktails")
                .with(jwt())
                .param("ingredientId", campari.id().toString())
                .param("search", "negroni"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
    // A cocktail can be discovered through an optional ingredient in another recipe.
    var optional = service.ingredients("spiced rum", null).getFirst();
    jdbc.update(
        "insert into recipe_ingredient select ?, ?, ?, 2, 'Optional spice', 'optional', preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and ingredient_id = ?",
        UUID.randomUUID(),
        extraRecipe,
        optional.id(),
        recipe.id(),
        campari.id());
    var optionalMatches = service.cocktails(null, null, optional.id(), null, false, "one");
    assertThat(optionalMatches)
        .extracting(CatalogResponses.CocktailSummary::id)
        .containsExactly(negroni.id());
    assertThat(optionalMatches.getFirst().availability()).isEqualTo(negroni.availability());
    assertThat(service.ingredient(optional.id(), "one").usageCount()).isEqualTo(1);
    var unused = service.ingredients("coconut rum", "spirit").getFirst();
    assertThat(service.cocktails(null, null, unused.id(), null, false, "one")).isEmpty();
    mvc.perform(
            get("/api/v1/cocktails/random")
                .with(jwt())
                .param("ingredientId", unused.id().toString()))
        .andExpect(status().isNotFound());
  }

  @Test
  void ingredientFilterValidatesBothEndpointsAndKeepsExistingPrimarySpiritRules() throws Exception {
    for (var endpoint : new String[] {"/api/v1/cocktails", "/api/v1/cocktails/random"}) {
      for (var id : new String[] {"bad", UUID.randomUUID().toString()}) {
        mvc.perform(get(endpoint).with(jwt()).param("ingredientId", id))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("status").value(400));
      }
      mvc.perform(get(endpoint).param("ingredientId", UUID.randomUUID().toString()))
          .andExpect(status().isUnauthorized());
    }
    var lime = service.ingredients("lime juice", "juice").getFirst();
    mvc.perform(get("/api/v1/cocktails").with(jwt()).param("ingredientId", lime.id().toString()))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/cocktails").with(jwt()).param("primarySpiritId", lime.id().toString()))
        .andExpect(status().isBadRequest());
    assertThat(service.cocktails(null, null, lime.id(), null, false, "one"))
        .extracting(CatalogResponses.CocktailSummary::id)
        .doesNotHaveDuplicates();
  }

  @Test
  void catalogRequiresAuthenticationAndProvidesNoWrites() throws Exception {
    for (var path :
        new String[] {
          "/ingredients",
          "/cocktails",
          "/ingredients/" + UUID.randomUUID(),
          "/cocktails/" + UUID.randomUUID()
        }) {
      mvc.perform(get("/api/v1" + path)).andExpect(status().isUnauthorized());
    }
    mvc.perform(post("/api/v1/ingredients").with(jwt())).andExpect(status().isMethodNotAllowed());
    mvc.perform(get("/api/v1/ingredients/" + UUID.randomUUID()).with(jwt()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("title").value("Not Found"));
    mvc.perform(get("/api/v1/cocktails/" + UUID.randomUUID()).with(jwt()))
        .andExpect(status().isNotFound());
    var first =
        mvc.perform(get("/api/v1/cocktails").with(jwt().jwt(j -> j.subject("one"))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var second =
        mvc.perform(get("/api/v1/cocktails").with(jwt().jwt(j -> j.subject("two"))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(first).isEqualTo(second);
  }

  @Test
  void fullCatalogUsesBoundedQueriesWithoutPerRowLoads() {
    var stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    var cocktails = service.cocktails("", null, null, null, false, "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(3);
    stats.clear();
    service.cocktail(cocktails.getFirst().id(), "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(5);
    var ingredient = service.ingredients("gin", "spirit").getFirst();
    stats.clear();
    service.ingredient(ingredient.id(), "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(4);
  }
}
