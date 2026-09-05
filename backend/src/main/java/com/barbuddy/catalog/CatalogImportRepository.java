package com.barbuddy.catalog;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class CatalogImportRepository {
  private final JdbcTemplate jdbc;

  CatalogImportRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  void lockImports() {
    jdbc.execute("select pg_advisory_xact_lock(734820121)");
  }

  List<String> ingredientIds() {
    return jdbc.queryForList("select catalog_id from ingredient", String.class);
  }

  Map<String, String> cocktailSlugs() {
    return pairs("select catalog_id, slug from cocktail");
  }

  Map<String, String> recipeCocktails() {
    return pairs(
        "select r.catalog_id, c.catalog_id from recipe r join cocktail c on c.id = r.cocktail_id");
  }

  private Map<String, String> pairs(String sql) {
    Map<String, String> values = new HashMap<>();
    jdbc.query(
        sql,
        rs -> {
          values.put(rs.getString(1), rs.getString(2));
        });
    return values;
  }

  void synchronize(String json) {
    jdbc.update(
        """
        insert into ingredient (id, catalog_id, name, category)
        select gen_random_uuid(), i->>'id', i->>'name', i->>'category'
        from jsonb_array_elements(?::jsonb->'ingredients') i
        on conflict (catalog_id) do update set name = excluded.name, category = excluded.category
        """,
        json);
    jdbc.update(
        """
        insert into cocktail (id, catalog_id, slug, name, primary_spirit_id)
        select gen_random_uuid(), c->>'id', c->>'slug', c->>'name', i.id
        from jsonb_array_elements(?::jsonb->'cocktails') c
        left join ingredient i on i.catalog_id = c->>'primarySpiritId'
        on conflict (catalog_id) do update set name = excluded.name, primary_spirit_id = excluded.primary_spirit_id
        """,
        json);
    jdbc.update(
        """
        insert into recipe (id, catalog_id, cocktail_id, name, instructions, glassware, garnish)
        select gen_random_uuid(), r->>'id', existing.id, r->>'name', r->>'instructions', r->>'glassware', r->>'garnish'
        from jsonb_array_elements(?::jsonb->'cocktails') c
        cross join lateral jsonb_array_elements(c->'recipes') r
        join cocktail existing on existing.catalog_id = c->>'id'
        on conflict (catalog_id) do update set name = excluded.name, instructions = excluded.instructions,
          glassware = excluded.glassware, garnish = excluded.garnish
        """,
        json);
    jdbc.update(
        """
        insert into recipe_ingredient
          (id, recipe_id, ingredient_id, position, recipe_display_name, requirement, preparation,
           us_quantity, us_maximum_quantity, us_unit, us_modifier,
           metric_quantity, metric_maximum_quantity, metric_unit, metric_modifier)
        select gen_random_uuid(), existing.id, ingredient.id, (line->>'position')::integer,
          line->>'recipeDisplayName', line->>'requirement', line->>'preparation',
          (line#>>'{measurements,us,quantity}')::numeric, (line#>>'{measurements,us,maximumQuantity}')::numeric,
          line#>>'{measurements,us,unit}', line#>>'{measurements,us,modifier}',
          (line#>>'{measurements,metric,quantity}')::numeric, (line#>>'{measurements,metric,maximumQuantity}')::numeric,
          line#>>'{measurements,metric,unit}', line#>>'{measurements,metric,modifier}'
        from jsonb_array_elements(?::jsonb->'cocktails') c
        cross join lateral jsonb_array_elements(c->'recipes') r
        cross join lateral jsonb_array_elements(r->'ingredients') line
        join recipe existing on existing.catalog_id = r->>'id'
        join ingredient on ingredient.catalog_id = line->>'ingredientId'
        on conflict (recipe_id, position) do update set ingredient_id = excluded.ingredient_id,
          recipe_display_name = excluded.recipe_display_name, requirement = excluded.requirement,
          preparation = excluded.preparation, us_quantity = excluded.us_quantity,
          us_maximum_quantity = excluded.us_maximum_quantity, us_unit = excluded.us_unit, us_modifier = excluded.us_modifier,
          metric_quantity = excluded.metric_quantity, metric_maximum_quantity = excluded.metric_maximum_quantity,
          metric_unit = excluded.metric_unit, metric_modifier = excluded.metric_modifier
        """,
        json);
    jdbc.update(
        """
        delete from recipe_ingredient existing using recipe
        where existing.recipe_id = recipe.id and not exists (
          select 1 from jsonb_array_elements(?::jsonb->'cocktails') c
          cross join lateral jsonb_array_elements(c->'recipes') r
          cross join lateral jsonb_array_elements(r->'ingredients') line
          where r->>'id' = recipe.catalog_id and (line->>'position')::integer = existing.position)
        """,
        json);
  }
}
