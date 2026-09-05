package com.barbuddy.ingredients;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "ingredient")
public class Ingredient {
  @Id private UUID id;

  @Column(name = "catalog_id", nullable = false, updatable = false, columnDefinition = "text")
  private String catalogId;

  @Column(name = "name", nullable = false, columnDefinition = "text")
  private String name;

  @Column(name = "category", nullable = false, columnDefinition = "text")
  private String category;

  protected Ingredient() {}

  public UUID getId() {
    return id;
  }

  public String getCatalogId() {
    return catalogId;
  }

  public String getName() {
    return name;
  }

  public String getCategory() {
    return category;
  }
}
