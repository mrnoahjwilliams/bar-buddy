package com.barbuddy.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.catalog.CatalogBrowseService;
import com.barbuddy.catalog.CatalogImportService;
import com.barbuddy.catalog.CatalogInput;
import jakarta.persistence.EntityManagerFactory;
import java.nio.file.Path;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.hibernate.SessionFactory;
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
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    properties = {
      "spring.config.import=",
      "spring.jpa.properties.hibernate.generate_statistics=true"
    })
@AutoConfigureMockMvc
@Testcontainers
class InventoryAvailabilityIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService catalog;
  @Autowired InventoryService inventory;
  @Autowired EntityManagerFactory emf;

  @BeforeEach
  void load() throws Exception {
    jdbc.execute(
        "truncate inventory_item, recipe_ingredient, recipe, cocktail, ingredient, app_user");
    importer.importCatalog(CatalogInput.read(Path.of("../catalog/cocktails.json")));
  }

  private UUID add(UUID ingredient, String label, String state) throws Exception {
    var response =
        mvc.perform(
                post("/api/v1/inventory")
                    .with(jwt().jwt(j -> j.subject("one")))
                    .contentType("application/json")
                    .content(
                        new JsonMapper()
                            .writeValueAsString(
                                java.util.Map.of(
                                    "ingredientId",
                                    ingredient,
                                    "bottleLabel",
                                    label,
                                    "status",
                                    state,
                                    "ownerUserId",
                                    UUID.randomUUID()))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("status").value(state))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return UUID.fromString(new JsonMapper().readTree(response).path("id").asString());
  }

  @Test
  void inventoryJourneyPersistsAndScopesEveryMutationToItsOwner() throws Exception {
    var gin = catalog.ingredients("Gin", "spirit").getFirst().id();
    var id = add(gin, "  First bottle  ", "Have");
    var second = add(gin, "", "Out");
    mvc.perform(get("/api/v1/inventory").with(jwt().jwt(j -> j.subject("one"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
    assertThat(inventory.list("one"))
        .extracting(InventoryResponse::bottleLabel)
        .containsExactlyInAnyOrder("First bottle", null);
    mvc.perform(get("/api/v1/inventory").with(jwt().jwt(j -> j.subject("two"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    for (var inaccessible : new UUID[] {id, UUID.randomUUID()}) {
      mvc.perform(
              patch("/api/v1/inventory/" + inaccessible)
                  .with(jwt().jwt(j -> j.subject("two")))
                  .contentType("application/json")
                  .content("{\"status\":\"Out\"}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("status").value(404));
      mvc.perform(
              delete("/api/v1/inventory/" + inaccessible).with(jwt().jwt(j -> j.subject("two"))))
          .andExpect(status().isNotFound());
    }
    for (String state : new String[] {"Out", "Have"}) {
      mvc.perform(
              patch("/api/v1/inventory/" + id)
                  .with(jwt().jwt(j -> j.subject("one")))
                  .contentType("application/json")
                  .content("{\"status\":\"" + state + "\",\"bottleLabel\":\"Renamed\"}"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("bottleLabel").value("Renamed"));
      assertThat(
              inventory.list("one").stream()
                  .filter(i -> i.id().equals(id))
                  .findFirst()
                  .orElseThrow()
                  .status()
                  .name())
          .isEqualTo(state);
    }
    mvc.perform(delete("/api/v1/inventory/" + id).with(jwt().jwt(j -> j.subject("one"))))
        .andExpect(status().isNoContent());
    assertThat(inventory.list("one")).extracting(InventoryResponse::id).containsExactly(second);
    mvc.perform(get("/api/v1/inventory")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/inventory").contentType("application/json").content("{}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(patch("/api/v1/inventory/" + second).contentType("application/json").content("{}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(delete("/api/v1/inventory/" + second)).andExpect(status().isUnauthorized());
  }

  @Test
  void invalidInputCannotCreateOrChangeInventory() throws Exception {
    var ingredient = catalog.ingredients("", null).getFirst().id();
    for (String input :
        new String[] {
          "{}",
          "null",
          "not json",
          "{\"ingredientId\":\"bad\",\"status\":\"Have\"}",
          "{\"ingredientId\":\"" + UUID.randomUUID() + "\",\"status\":\"Have\"}",
          "{\"ingredientId\":\"" + ingredient + "\",\"status\":\"Wishlist\"}",
          "{\"ingredientId\":\""
              + ingredient
              + "\",\"status\":\"Have\",\"bottleLabel\":\""
              + "a".repeat(201)
              + "\"}"
        }) {
      mvc.perform(
              post("/api/v1/inventory").with(jwt()).contentType("application/json").content(input))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("status").value(400));
    }
    assertThat(inventory.list("user")).isEmpty();
    var item = add(ingredient, "Good", "Have");
    mvc.perform(
            patch("/api/v1/inventory/" + item)
                .with(jwt().jwt(j -> j.subject("one")))
                .contentType("application/json")
                .content("{\"bottleLabel\":\"Changed\"}"))
        .andExpect(status().isBadRequest());
    assertThat(inventory.list("one").getFirst().bottleLabel()).isEqualTo("Good");
  }

  @Test
  void distinctRequirementsIgnoreOptionalLinesAndOtherUsersAndMixedOutBottles() throws Exception {
    var cocktail = catalog.cocktails("negroni", null, null, "one").getFirst();
    var recipe = catalog.cocktail(cocktail.id(), "one").recipe();
    var required = cocktail.availability().missingIngredients();
    assertThat(required).hasSize(3);
    jdbc.update(
        "insert into recipe_ingredient select ?, recipe_id, ingredient_id, 99, recipe_display_name, requirement, preparation, us_quantity, us_maximum_quantity, us_unit, us_modifier, metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier from recipe_ingredient where recipe_id = ? and position = 1",
        UUID.randomUUID(),
        recipe.id());
    assertThat(catalog.cocktail(cocktail.id(), "one").availability().missingCount()).isEqualTo(3);
    for (int i = 0; i < 2; i++) add(required.get(i).id(), "", "Have");
    var out = add(required.get(2).id(), "Empty", "Out");
    assertThat(catalog.cocktails("negroni", cocktail.primarySpirit().id(), "one_away", "one"))
        .hasSize(1);
    assertThat(catalog.cocktails("negroni", null, "can_make", "one")).isEmpty();
    assertThat(catalog.cocktail(cocktail.id(), "one").availability().missingIngredients())
        .containsExactly(required.get(2));
    var have = add(required.get(2).id(), "Full", "Have");
    assertThat(catalog.cocktail(cocktail.id(), "one").availability().canMake()).isTrue();
    assertThat(catalog.cocktails("negroni", null, "can_make", "one")).hasSize(1);
    assertThat(
            catalog.ingredient(required.getFirst().id(), "one").relatedCocktails().stream()
                .filter(c -> c.id().equals(cocktail.id()))
                .findFirst()
                .orElseThrow()
                .availability()
                .canMake())
        .isTrue();
    assertThat(catalog.cocktail(cocktail.id(), "two").availability().missingCount()).isEqualTo(3);
    inventory.delete("one", have);
    assertThat(catalog.cocktail(cocktail.id(), "one").availability().missingCount()).isEqualTo(1);
    inventory.update("one", out, new InventoryRequests.UpdateInventory(null, InventoryStatus.Have));
    assertThat(catalog.cocktail(cocktail.id(), "one").availability().canMake()).isTrue();
    mvc.perform(get("/api/v1/cocktails").with(jwt()).param("availability", "wrong"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("status").value(400));
    assertThat(catalog.cocktails("", null, "", "one")).hasSize(102);
    assertThat(catalog.cocktails("", null, null, "one"))
        .extracting(c -> c.availability().missingCount())
        .isSorted();
    var stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    catalog.cocktails("", null, null, "one");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(2);
    stats.clear();
    inventory.list("one");
    assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
    jdbc.update(
        "insert into inventory_item select gen_random_uuid(), (select id from app_user where auth_subject = 'one'), id, null, 'Have' from ingredient");
    assertThat(catalog.cocktails("", null, "can_make", "one")).hasSize(102);
    assertThat(catalog.cocktails("", null, "can_make", "two")).isEmpty();
  }

  @Test
  void upgradesExistingCatalogAndRestrictsProviderRolesAndInvalidRows() {
    var source =
        new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    Flyway.configure()
        .dataSource(source)
        .schemas("inventory_upgrade")
        .defaultSchema("inventory_upgrade")
        .target("2")
        .load()
        .migrate();
    var user = UUID.randomUUID();
    var ingredient = UUID.randomUUID();
    jdbc.update(
        "insert into inventory_upgrade.app_user (id, auth_subject) values (?, 'existing')", user);
    jdbc.update(
        "insert into inventory_upgrade.ingredient values (?, 'ingredient:existing', 'Existing', 'spirit')",
        ingredient);
    var upgrade =
        Flyway.configure()
            .dataSource(source)
            .schemas("inventory_upgrade")
            .defaultSchema("inventory_upgrade")
            .load();
    assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(1);
    assertThat(upgrade.migrate().migrationsExecuted).isZero();
    assertThat(jdbc.queryForObject("select id from inventory_upgrade.ingredient", UUID.class))
        .isEqualTo(ingredient);
    assertThat(jdbc.queryForObject("select id from inventory_upgrade.app_user", UUID.class))
        .isEqualTo(user);
    jdbc.update(
        "insert into inventory_upgrade.inventory_item values (?, ?, ?, null, 'Have')",
        UUID.randomUUID(),
        user,
        ingredient);
    for (String sql :
        new String[] {
          "update inventory_upgrade.inventory_item set status = 'No'",
          "update inventory_upgrade.inventory_item set bottle_label = ' '",
          "update inventory_upgrade.inventory_item set owner_user_id = gen_random_uuid()",
          "update inventory_upgrade.inventory_item set ingredient_id = gen_random_uuid()",
          "delete from inventory_upgrade.ingredient"
        }) {
      assertThatThrownBy(() -> jdbc.execute(sql))
          .isInstanceOf(DataIntegrityViolationException.class);
    }
    for (String role : new String[] {"anon", "authenticated", "service_role"}) {
      for (String privilege :
          new String[] {
            "select", "insert", "update", "delete", "truncate", "references", "trigger"
          }) {
        assertThat(
                jdbc.queryForObject(
                    "select has_table_privilege(?, 'public.inventory_item', ?)",
                    Boolean.class,
                    role,
                    privilege))
            .isFalse();
        assertThat(
                jdbc.queryForObject(
                    "select has_table_privilege(?, 'inventory_upgrade.inventory_item', ?)",
                    Boolean.class,
                    role,
                    privilege))
            .isFalse();
      }
    }
  }
}
