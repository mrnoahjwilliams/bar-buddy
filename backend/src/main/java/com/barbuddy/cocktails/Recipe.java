package com.barbuddy.cocktails;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "recipe")
public class Recipe {
  @Id private UUID id;

  @Column(name = "catalog_id", nullable = false, updatable = false, columnDefinition = "text")
  private String catalogId;

  @Column(name = "name", nullable = false, columnDefinition = "text")
  private String name;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "cocktail_id", nullable = false)
  private Cocktail cocktail;

  @Column(name = "instructions", nullable = false, columnDefinition = "text")
  private String instructions;

  @Column(name = "glassware", nullable = false, columnDefinition = "text")
  private String glassware;

  @Column(name = "garnish", nullable = true, columnDefinition = "text")
  private String garnish;

  protected Recipe() {}

  public UUID getId() {
    return id;
  }

  public String getCatalogId() {
    return catalogId;
  }

  public String getName() {
    return name;
  }

  public Cocktail getCocktail() {
    return cocktail;
  }

  public String getInstructions() {
    return instructions;
  }

  public String getGlassware() {
    return glassware;
  }

  public String getGarnish() {
    return garnish;
  }
}
