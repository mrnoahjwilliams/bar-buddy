package com.barbuddy.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.inventory.InventoryRequests;
import com.barbuddy.inventory.InventoryService;
import com.barbuddy.inventory.InventoryStatus;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest(properties = "spring.config.import=")
@AutoConfigureMockMvc
@Testcontainers
class CatalogSearchIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired CatalogImportService importer;
  @Autowired CatalogBrowseService catalog;
  @Autowired InventoryService inventory;
  @Autowired JdbcTemplate jdbc;
  @Autowired MockMvc mvc;
  @TempDir Path temporary;

  @Test
  void searchesNamesAndAliasesWithoutAccentsOrDuplicateResultsAndPreservesInventoryOnReimport()
      throws Exception {
    var full = CatalogInput.read(Path.of("../catalog/cocktails.json"));
    importer.importCatalog(full);
    for (String search :
        new String[] {"creme de cacao", "CRÈME DE CACAO", "cre\u0300me de cacao"}) {
      assertThat(catalog.ingredients(search, "liqueur"))
          .extracting(CatalogResponses.IngredientSummary::name)
          .containsExactly("Crème de cacao");
    }
    var orange = catalog.ingredients("triple sec", null).getFirst();
    assertThat(orange.name()).isEqualTo("Orange liqueur");
    assertThat(orange.matchedAlias()).isEqualTo("Triple sec");
    assertThat(catalog.ingredients("curacao", "liqueur"))
        .extracting(CatalogResponses.IngredientSummary::id)
        .containsExactly(orange.id());
    assertThat(catalog.ingredients("orange", "liqueur"))
        .extracting(CatalogResponses.IngredientSummary::matchedAlias)
        .containsOnlyNulls();
    assertThat(catalog.ingredients("triple sec", "spirit")).isEmpty();
    assertThat(catalog.ingredients("%", null)).isEmpty();
    assertThat(catalog.ingredients("_", null)).isEmpty();
    assertThat(catalog.ingredients("co", null))
        .extracting(CatalogResponses.IngredientSummary::id)
        .doesNotHaveDuplicates();
    assertThat(catalog.cocktails("piña colada", null, null, false, "one"))
        .extracting(CatalogResponses.CocktailSummary::name)
        .containsExactly("Pina Colada");
    mvc.perform(get("/api/v1/ingredients").param("search", "TRIPLE SEC").with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].matchedAlias").value("Triple sec"));
    var bottle =
        inventory.create(
            "one",
            new InventoryRequests.CreateInventory(
                orange.id(), "Cointreau at home", InventoryStatus.Have));
    var before = catalog.cocktails("", null, null, false, "one");
    for (String name : new String[] {"Spiced rum", "Coconut rum", "Coconut rum liqueur"}) {
      var ingredient =
          catalog.ingredients(name, null).stream()
              .filter(i -> i.name().equals(name))
              .findFirst()
              .orElseThrow();
      assertThat(catalog.ingredient(ingredient.id(), "one").usageCount()).isZero();
      inventory.create(
          "one",
          new InventoryRequests.CreateInventory(ingredient.id(), null, InventoryStatus.Have));
    }
    assertThat(catalog.cocktails("", null, null, false, "one")).isEqualTo(before);
    assertThat(catalog.ingredients("Malibu", null))
        .extracting(CatalogResponses.IngredientSummary::name)
        .containsExactly("Coconut rum liqueur");
    importer.importCatalog(full);
    assertThat(inventory.list("one")).contains(bottle);
    assertThat(inventory.list("two")).isEmpty();
    var corrected = (ObjectNode) new JsonMapper().readTree(full.json());
    for (var node : corrected.withArray("ingredients")) {
      if (node.path("id").asString().equals("ingredient:orange-liqueur"))
        ((ObjectNode) node).withArray("aliases").add("Orange cordial");
    }
    var correction = temporary.resolve("correction.json");
    Files.writeString(correction, new JsonMapper().writeValueAsString(corrected));
    importer.importCatalog(CatalogInput.read(correction));
    assertThat(catalog.ingredients("orange cordial", null).getFirst().id()).isEqualTo(orange.id());
    assertThat(inventory.list("one")).contains(bottle);
    importer.importCatalog(full);
    assertThat(catalog.ingredients("orange cordial", null)).isEmpty();
  }

  @Test
  void migrationKeepsExistingInventoryAndDeniesProviderFunctionAccess() {
    var source =
        new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    Flyway.configure()
        .dataSource(source)
        .schemas("alias_upgrade")
        .defaultSchema("alias_upgrade")
        .target("3")
        .load()
        .migrate();
    var user = UUID.randomUUID();
    var ingredient = UUID.randomUUID();
    var item = UUID.randomUUID();
    jdbc.update(
        "insert into alias_upgrade.app_user (id, auth_subject) values (?, 'existing')", user);
    jdbc.update(
        "insert into alias_upgrade.ingredient values (?, 'ingredient:existing', 'Crème test', 'liqueur')",
        ingredient);
    jdbc.update(
        "insert into alias_upgrade.inventory_item values (?, ?, ?, 'Original label', 'Have')",
        item,
        user,
        ingredient);
    var upgrade =
        Flyway.configure()
            .dataSource(source)
            .schemas("alias_upgrade")
            .defaultSchema("alias_upgrade")
            .target("4")
            .load();
    assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(1);
    assertThat(upgrade.migrate().migrationsExecuted).isZero();
    assertThat(
            jdbc.queryForObject(
                "select bottle_label from alias_upgrade.inventory_item where id = ?",
                String.class,
                item))
        .isEqualTo("Original label");
    assertThat(
            jdbc.queryForObject(
                "select cardinality(aliases) from alias_upgrade.ingredient", Integer.class))
        .isZero();
    assertThat(
            jdbc.queryForObject(
                "select alias_upgrade.catalog_search_key(name) from alias_upgrade.ingredient",
                String.class))
        .isEqualTo("creme test");
    for (String role : new String[] {"anon", "authenticated", "service_role"}) {
      assertThat(
              jdbc.queryForObject(
                  "select has_function_privilege(?, 'public.catalog_search_key(text)', 'execute')",
                  Boolean.class,
                  role))
          .isFalse();
      assertThat(
              jdbc.queryForObject(
                  "select has_function_privilege(?, 'alias_upgrade.catalog_search_key(text)', 'execute')",
                  Boolean.class,
                  role))
          .isFalse();
      assertThat(
              jdbc.queryForObject(
                  "select has_column_privilege(?, 'public.ingredient', 'aliases', 'select')",
                  Boolean.class,
                  role))
          .isFalse();
    }
  }
}
