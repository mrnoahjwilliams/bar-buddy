package com.barbuddy.inventory;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InventoryRepository extends JpaRepository<InventoryItem, UUID> {
  @Query(
      "select count(i) from InventoryItem i where i.owner.authSubject = :subject and i.status = :status")
  long countItems(String subject, InventoryStatus status);

  @Query(
      "select count(distinct i.ingredient.id) from InventoryItem i where i.owner.authSubject = :subject and i.status = com.barbuddy.inventory.InventoryStatus.Have")
  long countAvailableIngredients(String subject);

  @Query(
      "select i from InventoryItem i join fetch i.ingredient where i.owner.authSubject = :subject order by lower(i.ingredient.name), i.id")
  List<InventoryItem> owned(String subject);

  @Query(
      "select i from InventoryItem i join fetch i.ingredient where i.id = :id and i.owner.authSubject = :subject")
  Optional<InventoryItem> ownedItem(UUID id, String subject);
}
