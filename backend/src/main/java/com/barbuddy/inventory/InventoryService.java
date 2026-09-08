package com.barbuddy.inventory;

import com.barbuddy.catalog.CatalogBrowseRepository;
import com.barbuddy.users.CurrentUserService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class InventoryService {
  private final InventoryRepository items;
  private final CatalogBrowseRepository catalog;
  private final CurrentUserService users;

  InventoryService(
      InventoryRepository items, CatalogBrowseRepository catalog, CurrentUserService users) {
    this.items = items;
    this.catalog = catalog;
    this.users = users;
  }

  @Transactional(readOnly = true)
  public List<InventoryResponse> list(String subject) {
    return items.owned(subject).stream().map(InventoryResponse::from).toList();
  }

  public InventoryResponse create(String subject, InventoryRequests.CreateInventory input) {
    var ingredient = catalog.ingredient(input.ingredientId());
    if (ingredient == null)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Ingredient must identify a catalog ingredient.");
    return InventoryResponse.from(
        items.save(
            new InventoryItem(
                users.resolve(subject), ingredient, label(input.bottleLabel()), input.status())));
  }

  public InventoryResponse update(
      String subject, UUID id, InventoryRequests.UpdateInventory input) {
    var item = owned(subject, id);
    item.update(label(input.bottleLabel()), input.status());
    return InventoryResponse.from(item);
  }

  public void delete(String subject, UUID id) {
    items.delete(owned(subject, id));
  }

  private InventoryItem owned(String subject, UUID id) {
    return items
        .ownedItem(id, subject)
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found."));
  }

  private static String label(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }
}
