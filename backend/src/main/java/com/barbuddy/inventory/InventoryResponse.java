package com.barbuddy.inventory;

import com.barbuddy.catalog.CatalogResponses.IngredientSummary;
import java.util.UUID;

public record InventoryResponse(
    UUID id, IngredientSummary ingredient, String bottleLabel, InventoryStatus status) {
  static InventoryResponse from(InventoryItem item) {
    var ingredient = item.getIngredient();
    return new InventoryResponse(
        item.getId(),
        new IngredientSummary(
            ingredient.getId(), ingredient.getName(), ingredient.getCategory(), null),
        item.getBottleLabel(),
        item.getStatus());
  }
}
