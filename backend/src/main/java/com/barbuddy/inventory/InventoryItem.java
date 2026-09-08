package com.barbuddy.inventory;

import com.barbuddy.ingredients.Ingredient;
import com.barbuddy.users.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "inventory_item")
public class InventoryItem {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "owner_user_id", nullable = false, updatable = false)
  private AppUser owner;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "ingredient_id", nullable = false, updatable = false)
  private Ingredient ingredient;

  @Column(name = "bottle_label", length = 200)
  private String bottleLabel;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 4)
  private InventoryStatus status;

  protected InventoryItem() {}

  InventoryItem(AppUser owner, Ingredient ingredient, String label, InventoryStatus status) {
    this.id = UUID.randomUUID();
    this.owner = owner;
    this.ingredient = ingredient;
    update(label, status);
  }

  void update(String label, InventoryStatus status) {
    this.bottleLabel = label;
    this.status = status;
  }

  public UUID getId() {
    return id;
  }

  public Ingredient getIngredient() {
    return ingredient;
  }

  public String getBottleLabel() {
    return bottleLabel;
  }

  public InventoryStatus getStatus() {
    return status;
  }
}
