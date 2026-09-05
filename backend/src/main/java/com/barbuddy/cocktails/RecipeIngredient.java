package com.barbuddy.cocktails;

import com.barbuddy.ingredients.Ingredient;
import com.barbuddy.shared.measurement.Measurement;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "recipe_ingredient")
public class RecipeIngredient {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "recipe_id", nullable = false)
  private Recipe recipe;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "ingredient_id", nullable = false)
  private Ingredient ingredient;

  @Column(nullable = false)
  private int position;

  @Column(name = "recipe_display_name", nullable = false, columnDefinition = "text")
  private String recipeDisplayName;

  @Column(name = "requirement", nullable = false, columnDefinition = "text")
  private String requirement;

  @Column(name = "preparation", nullable = true, columnDefinition = "text")
  private String preparation;

  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "quantity", column = @Column(name = "us_quantity")),
    @AttributeOverride(name = "maximumQuantity", column = @Column(name = "us_maximum_quantity")),
    @AttributeOverride(name = "unit", column = @Column(name = "us_unit")),
    @AttributeOverride(name = "modifier", column = @Column(name = "us_modifier"))
  })
  private Measurement us;

  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "quantity", column = @Column(name = "metric_quantity")),
    @AttributeOverride(
        name = "maximumQuantity",
        column = @Column(name = "metric_maximum_quantity")),
    @AttributeOverride(name = "unit", column = @Column(name = "metric_unit")),
    @AttributeOverride(name = "modifier", column = @Column(name = "metric_modifier"))
  })
  private Measurement metric;

  protected RecipeIngredient() {}

  public UUID getId() {
    return id;
  }

  public Recipe getRecipe() {
    return recipe;
  }

  public Ingredient getIngredient() {
    return ingredient;
  }

  public int getPosition() {
    return position;
  }

  public String getRecipeDisplayName() {
    return recipeDisplayName;
  }

  public String getRequirement() {
    return requirement;
  }

  public String getPreparation() {
    return preparation;
  }

  public Measurement getUs() {
    return us;
  }

  public Measurement getMetric() {
    return metric;
  }
}
