package com.barbuddy.ingredients;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(nullable = false, columnDefinition = "text[]")
  private String[] aliases = new String[0];

  public String[] getAliases() {
    return aliases.clone();
  }

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
