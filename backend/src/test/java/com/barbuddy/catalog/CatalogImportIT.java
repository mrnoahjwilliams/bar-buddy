package com.barbuddy.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@Testcontainers
class CatalogImportIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired CatalogImportService importer;
  @Autowired JdbcTemplate jdbc;
  @TempDir Path temporary;
  private final JsonMapper mapper = new JsonMapper();

  @BeforeEach
  void clearCatalog() {
    jdbc.execute("drop table if exists reference_probe");
    jdbc.execute("truncate recipe_ingredient, recipe, cocktail, ingredient");
  }

  @Test
  void fullCatalogAndConcurrentRepeatsPreserveEveryIdentity() throws Exception {
    CatalogInput full = CatalogInput.read(Path.of("../catalog/cocktails.json"));
    importer.importCatalog(full);
    assertThat(count("ingredient")).isEqualTo(113);
    assertThat(count("cocktail")).isEqualTo(102);
    assertThat(count("recipe")).isEqualTo(102);
    assertThat(count("recipe_ingredient")).isEqualTo(416);
    var before = snapshot();
    try (var workers = Executors.newFixedThreadPool(2)) {
      var first = workers.submit(() -> importer.importCatalog(full));
      var second = workers.submit(() -> importer.importCatalog(full));
      first.get(30, TimeUnit.SECONDS);
      second.get(30, TimeUnit.SECONDS);
    }
    assertThat(snapshot()).isEqualTo(before);
  }

  @Test
  void correctionsPreserveReferencesAndSynchronizeOrderedLines() throws Exception {
    ObjectNode fixture = fixture();
    importer.importCatalog(validated(fixture));
    var ids =
        jdbc.queryForMap(
            "select i.id ingredient, c.id cocktail, r.id recipe from ingredient i cross join cocktail c cross join recipe r where i.catalog_id = 'ingredient:fixture-spirit'");
    jdbc.execute(
        "create table reference_probe (ingredient_id uuid references ingredient, cocktail_id uuid references cocktail, recipe_id uuid references recipe)");
    jdbc.update(
        "insert into reference_probe values (?, ?, ?)",
        ids.get("ingredient"),
        ids.get("cocktail"),
        ids.get("recipe"));
    ObjectNode ingredient = (ObjectNode) fixture.withArray("ingredients").get(0);
    ingredient.put("name", "Corrected canonical spirit");
    ObjectNode cocktail = (ObjectNode) fixture.withArray("cocktails").get(0);
    cocktail.put("name", "Corrected drink");
    ObjectNode recipe = (ObjectNode) cocktail.withArray("recipes").get(0);
    recipe.put("instructions", "Stir carefully.");
    ObjectNode line = (ObjectNode) recipe.withArray("ingredients").get(0);
    ((ObjectNode) line.path("measurements").path("us"))
        .put("quantity", 0.75)
        .put("modifier", "scant");
    ((ObjectNode) line.path("measurements").path("metric")).put("quantity", 20);
    recipe.withArray("ingredients").add(line.deepCopy().put("position", 3));
    importer.importCatalog(validated(fixture));
    assertThat(count("recipe_ingredient")).isEqualTo(3);
    assertThat(
            jdbc.queryForObject(
                "select count(distinct ingredient_id) from recipe_ingredient", Integer.class))
        .isEqualTo(2);
    recipe.withArray("ingredients").remove(2);
    recipe.withArray("ingredients").remove(1);
    importer.importCatalog(validated(fixture));
    assertThat(count("recipe_ingredient")).isEqualTo(1);
    assertThat(
            jdbc.queryForMap(
                "select ingredient_id ingredient, cocktail_id cocktail, recipe_id recipe from reference_probe"))
        .isEqualTo(ids);
    assertThat(jdbc.queryForObject("select instructions from recipe", String.class))
        .isEqualTo("Stir carefully.");
    assertThat(
            jdbc.queryForObject(
                "select us_quantity from recipe_ingredient", java.math.BigDecimal.class))
        .isEqualByComparingTo("0.75");
    assertThat(
            jdbc.queryForObject(
                "select metric_quantity from recipe_ingredient", java.math.BigDecimal.class))
        .isEqualByComparingTo("20");
    assertThat(
            jdbc.queryForObject(
                "select name from ingredient where id = ?", String.class, ids.get("ingredient")))
        .isEqualTo("Corrected canonical spirit");
  }

  @Test
  void missingIdentitiesSlugChangesAndLateDatabaseFailuresLeaveNoPartialChanges() throws Exception {
    importer.importCatalog(validated(fixture()));
    var before = snapshot();
    ObjectNode missing = fixture();
    missing
        .withArray("ingredients")
        .addObject()
        .put("id", "ingredient:extra")
        .put("name", "Extra")
        .put("category", "other");
    importer.importCatalog(validated(missing));
    var withExtra = snapshot();
    assertThatThrownBy(() -> importer.importCatalog(validated(fixture())))
        .hasMessageContaining("ingredient:extra");
    assertThat(snapshot()).isEqualTo(withExtra);
    jdbc.update("delete from ingredient where catalog_id = 'ingredient:extra'");
    jdbc.update(
        "insert into cocktail (id, catalog_id, slug, name) values (?, 'cocktail:extra', 'extra', 'Extra')",
        UUID.randomUUID());
    assertThatThrownBy(() -> importer.importCatalog(validated(fixture())))
        .hasMessageContaining("cocktail:extra");
    jdbc.update("delete from cocktail where catalog_id = 'cocktail:extra'");
    jdbc.update(
        "insert into recipe (id, catalog_id, cocktail_id, name, instructions, glassware) select ?, 'recipe:fixture-drink:extra', id, 'Extra', 'Stir.', 'Coupe' from cocktail",
        UUID.randomUUID());
    assertThatThrownBy(() -> importer.importCatalog(validated(fixture())))
        .hasMessageContaining("recipe:fixture-drink:extra");
    jdbc.update("delete from recipe where catalog_id = 'recipe:fixture-drink:extra'");
    ObjectNode changed = fixture();
    ((ObjectNode) changed.withArray("cocktails").get(0)).put("slug", "renamed-slug");
    assertThatThrownBy(() -> importer.importCatalog(validated(changed)))
        .hasMessageContaining("stable slug");
    assertThat(snapshot()).isEqualTo(before);
    jdbc.execute(
        "alter table recipe_ingredient add constraint reject_import_probe check (us_quantity < 2)");
    try {
      ObjectNode lateFailure = fixture();
      ((ObjectNode) lateFailure.withArray("ingredients").get(0)).put("name", "Must roll back");
      ((ObjectNode)
              lateFailure
                  .path("cocktails")
                  .get(0)
                  .path("recipes")
                  .get(0)
                  .path("ingredients")
                  .get(0)
                  .path("measurements")
                  .path("us"))
          .put("quantity", 3);
      assertThatThrownBy(() -> importer.importCatalog(validated(lateFailure)))
          .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
      assertThat(snapshot()).isEqualTo(before);
    } finally {
      jdbc.execute("alter table recipe_ingredient drop constraint reject_import_probe");
    }
  }

  @Test
  void invalidSnapshotIsRejectedAndCannotBeChangedAfterValidation() throws Exception {
    assertThatThrownBy(
            () ->
                CatalogInput.read(Path.of("../catalog/test/fixtures/invalid/broken-catalog.json")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("catalog validation failed");
    Path file = temporary.resolve("snapshot.json");
    Files.writeString(file, mapper.writeValueAsString(fixture()));
    CatalogInput validated = CatalogInput.read(file);
    Files.writeString(file, "invalid JSON");
    importer.importCatalog(validated);
    assertThat(count("ingredient")).isEqualTo(2);
  }

  @Test
  void packagedOperatorCommandWorksWithoutWebServerAndRejectsInvalidInputBeforeDatabase()
      throws Exception {
    Path jar = Path.of("target/bar-buddy-0.0.1-SNAPSHOT.jar").toAbsolutePath();
    var command =
        new ProcessBuilder(
            Path.of(System.getProperty("java.home"), "bin/java").toString(),
            "-Dloader.main=com.barbuddy.catalog.CatalogImportApplication",
            "-cp",
            jar.toString(),
            "org.springframework.boot.loader.launch.PropertiesLauncher",
            Path.of("../catalog/test/fixtures/valid/minimal-catalog.json")
                .toAbsolutePath()
                .toString());
    command.directory(temporary.toFile());
    command
        .environment()
        .putAll(
            Map.of(
                "DB_URL",
                POSTGRES.getJdbcUrl(),
                "DB_USERNAME",
                POSTGRES.getUsername(),
                "DB_PASSWORD",
                POSTGRES.getPassword()));
    Path log = temporary.resolve("command.log");
    command.redirectErrorStream(true).redirectOutput(log.toFile());
    var process = command.start();
    assertThat(process.waitFor(40, TimeUnit.SECONDS)).isTrue();
    assertThat(process.exitValue()).as(Files.readString(log)).isZero();
    assertThat(Files.readString(log))
        .contains("Catalog import completed successfully.")
        .doesNotContain("Tomcat started");
    assertThat(count("recipe_ingredient")).isEqualTo(2);
    command
        .command()
        .set(
            5,
            Path.of("../catalog/test/fixtures/invalid/broken-catalog.json")
                .toAbsolutePath()
                .toString());
    command.environment().put("DB_URL", "jdbc:postgresql://127.0.0.1:1/unreachable");
    process = command.start();
    assertThat(process.waitFor(20, TimeUnit.SECONDS)).isTrue();
    assertThat(process.exitValue()).isNotZero();
    assertThat(Files.readString(log))
        .contains("catalog validation failed")
        .doesNotContain("HikariPool");
  }

  private ObjectNode fixture() throws Exception {
    return (ObjectNode)
        mapper.readTree(
            Files.readString(Path.of("../catalog/test/fixtures/valid/minimal-catalog.json")));
  }

  private CatalogInput validated(ObjectNode document) throws Exception {
    Path path = temporary.resolve(UUID.randomUUID() + ".json");
    Files.writeString(path, mapper.writeValueAsString(document));
    return CatalogInput.read(path);
  }

  private int count(String table) {
    return jdbc.queryForObject("select count(*) from " + table, Integer.class);
  }

  private Map<String, Object> snapshot() {
    return Map.of(
        "ingredients",
        jdbc.queryForList("select * from ingredient order by id"),
        "cocktails",
        jdbc.queryForList("select * from cocktail order by id"),
        "recipes",
        jdbc.queryForList("select * from recipe order by id"),
        "lines",
        jdbc.queryForList("select * from recipe_ingredient order by id"));
  }
}
