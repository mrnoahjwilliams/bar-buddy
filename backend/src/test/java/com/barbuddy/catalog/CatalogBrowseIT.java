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
    jdbc.execute("truncate inventory_item, recipe_ingredient, recipe, cocktail, ingredient");
    importer.importCatalog(CatalogInput.read(Path.of("../catalog/cocktails.json")));
  }

  @Test
  void combinesFiltersResetsAndTreatsSearchLiterally() throws Exception {
    var gin =
        service.ingredients("gin", "spirit").stream()
            .filter(i -> i.name().equals("Gin"))
            .findFirst()
            .orElseThrow();
    assertThat(service.ingredients("  GIN  ", "spirit")).contains(gin);
    assertThat(service.ingredients("", "")).hasSize(116);
    assertThat(service.ingredients("%", null)).isEmpty();
    assertThat(service.cocktails("", null, null, "user")).hasSize(102);
    assertThat(service.cocktails("negroni", gin.id(), null, "user")).hasSize(1);
    assertThat(service.cocktails("zzzz", gin.id(), null, "user")).isEmpty();
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
    var drink = service.cocktails("negroni", null, null, "user").getFirst();
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
    var cocktails = service.cocktails("", null, null, "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(2);
    stats.clear();
    service.cocktail(cocktails.getFirst().id(), "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(4);
    var ingredient = service.ingredients("gin", "spirit").getFirst();
    stats.clear();
    service.ingredient(ingredient.id(), "user");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(3);
  }
}
