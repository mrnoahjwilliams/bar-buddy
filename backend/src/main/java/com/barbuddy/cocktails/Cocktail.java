package com.barbuddy.cocktails;

import com.barbuddy.ingredients.Ingredient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "cocktail")
public class Cocktail {
  @Id private UUID id;

  @Column(name = "catalog_id", nullable = false, updatable = false, columnDefinition = "text")
  private String catalogId;

  @Column(name = "name", nullable = false, columnDefinition = "text")
  private String name;

  @Column(name = "slug", nullable = false, updatable = false, columnDefinition = "text")
  private String slug;

  @ManyToOne(fetch = FetchType.LAZY, optional = true)
  @JoinColumn(name = "primary_spirit_id", nullable = true)
  private Ingredient primarySpirit;

  protected Cocktail() {}

  public UUID getId() {
    return id;
  }

  public String getCatalogId() {
    return catalogId;
  }

  public String getName() {
    return name;
  }

  public String getSlug() {
    return slug;
  }

  public Ingredient getPrimarySpirit() {
    return primarySpirit;
  }
}
