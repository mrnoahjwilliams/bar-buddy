package com.barbuddy.inventory;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class InventoryRequests {
  private InventoryRequests() {}

  public record CreateInventory(
      @NotNull UUID ingredientId,
      @Size(max = 200) String bottleLabel,
      @NotNull InventoryStatus status) {}

  // PATCH replaces the editable label/status pair; ingredient identity stays fixed.
  public record UpdateInventory(
      @Size(max = 200) String bottleLabel, @NotNull InventoryStatus status) {}
}
