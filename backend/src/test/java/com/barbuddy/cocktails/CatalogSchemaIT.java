package com.barbuddy.cocktails;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.barbuddy.ingredients.Ingredient;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class CatalogSchemaIT {
  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer("postgres:17.11-alpine").withInitScript("provider-roles.sql");

  @Autowired JdbcTemplate jdbc;
  @Autowired EntityManager entities;
  @Autowired PlatformTransactionManager transactions;

  @Test
  void mapsRelationshipsAndReviewedMeasurementsAndRejectsInvalidData() {
    UUID ingredient = UUID.randomUUID();
    UUID cocktail = UUID.randomUUID();
    UUID recipe = UUID.randomUUID();
    UUID line = UUID.randomUUID();
    jdbc.update(
        "insert into ingredient values (?, 'ingredient:test', 'Test spirit', 'spirit')",
        ingredient);
    jdbc.update(
        "insert into cocktail values (?, 'cocktail:test', 'test', 'Test', ?)",
        cocktail,
        ingredient);
    jdbc.update(
        "insert into recipe values (?, 'recipe:test:default', ?, 'Default', 'Stir.', 'Coupe', null)",
        recipe,
        cocktail);
    String insertLine =
        """
        insert into recipe_ingredient
        (id, recipe_id, ingredient_id, position, recipe_display_name, requirement,
         us_quantity, us_unit, us_modifier, metric_quantity, metric_unit)
        values (?, ?, ?, ?, 'Specific spirit', 'required', 0.75, 'ounce', 'scant', 20, 'milliliter')
        """;
    jdbc.update(insertLine, line, recipe, ingredient, 1);
    jdbc.update(insertLine, UUID.randomUUID(), recipe, ingredient, 2);
    new TransactionTemplate(transactions)
        .executeWithoutResult(
            status -> {
              var mapped = entities.find(RecipeIngredient.class, line);
              assertThat(mapped.getIngredient().getId()).isEqualTo(ingredient);
              assertThat(mapped.getRecipe().getCocktail().getPrimarySpirit().getName())
                  .isEqualTo("Test spirit");
              assertThat(mapped.getUs().getQuantity()).isEqualByComparingTo("0.75");
              assertThat(mapped.getUs().getModifier()).isEqualTo("scant");
              assertThat(mapped.getMetric().getQuantity()).isEqualByComparingTo("20");
              assertThat(entities.find(Ingredient.class, ingredient).getCatalogId())
                  .isEqualTo("ingredient:test");
            });
    assertThatThrownBy(() -> jdbc.update(insertLine, UUID.randomUUID(), recipe, ingredient, 1))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    for (String update :
        new String[] {
          "update recipe_ingredient set ingredient_id = '00000000-0000-0000-0000-000000000000'",
          "update recipe_ingredient set position = 0",
          "update recipe_ingredient set requirement = 'wishlist'",
          "update recipe_ingredient set us_quantity = -1",
          "update recipe_ingredient set us_quantity = 'NaN'",
          "update recipe_ingredient set metric_modifier = 'heavy'",
          "update recipe_ingredient set metric_unit = 'piece'",
          "update recipe_ingredient set metric_quantity = null",
          "update recipe_ingredient set us_maximum_quantity = 0.5",
          "update ingredient set category = 'bottle'",
          "update cocktail set name = ' '",
          "delete from ingredient",
          "delete from cocktail",
          "delete from recipe"
        }) {
      assertThatThrownBy(() -> jdbc.execute(update))
          .as(update)
          .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "insert into ingredient values (?, 'ingredient:test', 'Other', 'spirit')",
                    UUID.randomUUID()))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    jdbc.execute(
        "update recipe_ingredient set us_quantity = null, us_modifier = null, us_unit = 'to-taste', metric_quantity = null, metric_unit = 'to-taste', requirement = 'optional'");
    for (String role : new String[] {"anon", "authenticated", "service_role"}) {
      for (String table : new String[] {"ingredient", "cocktail", "recipe", "recipe_ingredient"}) {
        for (String privilege :
            new String[] {
              "select", "insert", "update", "delete", "truncate", "references", "trigger"
            }) {
          assertThat(
                  jdbc.queryForObject(
                      "select has_table_privilege(?, ?, ?)", Boolean.class, role, table, privilege))
              .as("%s %s %s", role, table, privilege)
              .isFalse();
        }
      }
    }
  }

  @Test
  void upgradesIdentityDatabaseWithoutLosingUsersAndCanRerunMigrations() {
    var source =
        new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    var isolated = new JdbcTemplate(source);
    // A separate schema exercises the real V1 -> V2 path without resetting Spring's schema.
    Flyway.configure()
        .dataSource(source)
        .schemas("upgrade_test")
        .defaultSchema("upgrade_test")
        .target("1")
        .load()
        .migrate();
    UUID user = UUID.randomUUID();
    isolated.update(
        "insert into upgrade_test.app_user (id, auth_subject) values (?, 'existing-subject')",
        user);
    var upgrade =
        Flyway.configure()
            .dataSource(source)
            .schemas("upgrade_test")
            .defaultSchema("upgrade_test")
            .load();
    assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(1);
    assertThat(upgrade.migrate().migrationsExecuted).isZero();
    assertThat(
            isolated.queryForObject(
                "select id from upgrade_test.app_user where auth_subject = 'existing-subject'",
                UUID.class))
        .isEqualTo(user);
    assertThat(
            isolated.queryForObject("select count(*) from upgrade_test.ingredient", Integer.class))
        .isZero();
  }
}
