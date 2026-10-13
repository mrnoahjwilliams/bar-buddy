package com.barbuddy.catalog;

import com.barbuddy.cocktails.Cocktail;
import com.barbuddy.cocktails.RecipeIngredient;
import com.barbuddy.ingredients.Ingredient;
import com.barbuddy.shared.measurement.Measurement;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public final class CatalogResponses {
  private CatalogResponses() {}

  public record IngredientSummary(UUID id, String name, String category, String matchedAlias) {
    static IngredientSummary from(Ingredient i) {
      return new IngredientSummary(i.getId(), i.getName(), i.getCategory(), null);
    }
  }

  public record CocktailSummary(
      UUID id,
      String name,
      String slug,
      IngredientSummary primarySpirit,
      AvailabilityResult availability,
      boolean favorite,
      UUID matchedIngredientId,
      List<String> styles,
      List<String> tags,
      @Schema(
              nullable = true,
              description = "Reviewed default recipe classification; null means unknown.")
          Boolean alcoholFree,
      int ingredientCount,
      int discoveryVersion,
      List<String> aliases,
      String matchedAlias) {
    public CocktailSummary withMatchedAlias(String match) {
      return new CocktailSummary(
          id,
          name,
          slug,
          primarySpirit,
          availability,
          favorite,
          matchedIngredientId,
          styles,
          tags,
          alcoholFree,
          ingredientCount,
          discoveryVersion,
          aliases,
          match);
    }

    static CocktailSummary from(
        Cocktail c,
        AvailabilityResult availability,
        boolean favorite,
        UUID matchedIngredientId,
        int ingredientCount) {
      return new CocktailSummary(
          c.getId(),
          c.getName(),
          c.getSlug(),
          c.getPrimarySpirit() == null ? null : IngredientSummary.from(c.getPrimarySpirit()),
          availability,
          favorite,
          matchedIngredientId,
          List.copyOf(Arrays.asList(c.getStyles())),
          List.copyOf(Arrays.asList(c.getTags())),
          c.getAlcoholFree(),
          ingredientCount,
          1,
          List.copyOf(Arrays.asList(c.getAliases())),
          null);
    }
  }

  public record AvailabilityResult(
      boolean canMake, int missingCount, List<IngredientSummary> missingIngredients) {
    static AvailabilityResult from(List<IngredientSummary> missing) {
      return new AvailabilityResult(missing.isEmpty(), missing.size(), List.copyOf(missing));
    }
  }

  public record IngredientDetail(
      UUID id,
      String name,
      String category,
      int usageCount,
      List<CocktailSummary> relatedCocktails) {}

  public record DisplayMeasurement(
      BigDecimal quantity, BigDecimal maximumQuantity, String unit, String modifier) {
    static DisplayMeasurement from(Measurement m) {
      return m == null
          ? null
          : new DisplayMeasurement(
              m.getQuantity(), m.getMaximumQuantity(), m.getUnit(), m.getModifier());
    }
  }

  public record RecipeLine(
      IngredientSummary ingredient,
      int position,
      String displayName,
      String requirement,
      String preparation,
      DisplayMeasurement us,
      DisplayMeasurement metric) {
    static RecipeLine from(RecipeIngredient l) {
      return new RecipeLine(
          IngredientSummary.from(l.getIngredient()),
          l.getPosition(),
          l.getRecipeDisplayName(),
          l.getRequirement(),
          l.getPreparation(),
          DisplayMeasurement.from(l.getUs()),
          DisplayMeasurement.from(l.getMetric()));
    }
  }

  public record RecipeDetail(
      UUID id,
      String name,
      String instructions,
      String glassware,
      String garnish,
      List<RecipeLine> ingredients) {}

  public record CocktailDetail(
      UUID id,
      String name,
      String slug,
      IngredientSummary primarySpirit,
      RecipeDetail recipe,
      AvailabilityResult availability,
      boolean favorite,
      List<String> styles,
      List<String> tags,
      @Schema(
              nullable = true,
              description = "Reviewed default recipe classification; null means unknown.")
          Boolean alcoholFree,
      int ingredientCount) {}
}
