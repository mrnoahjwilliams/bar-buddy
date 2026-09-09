package com.barbuddy.home;

import com.barbuddy.catalog.CatalogBrowseService;
import com.barbuddy.inventory.InventoryRepository;
import com.barbuddy.inventory.InventoryStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HomeService {
  private final InventoryRepository inventory;
  private final CatalogBrowseService catalog;

  HomeService(InventoryRepository inventory, CatalogBrowseService catalog) {
    this.inventory = inventory;
    this.catalog = catalog;
  }

  public HomeSummary summary(String subject) {
    var cocktails = catalog.cocktails(null, null, null, false, subject);
    return new HomeSummary(
        inventory.countItems(subject, InventoryStatus.Have),
        inventory.countItems(subject, InventoryStatus.Out),
        inventory.countAvailableIngredients(subject),
        cocktails.stream().filter(c -> c.availability().canMake()).count(),
        cocktails.stream().filter(c -> c.availability().missingCount() == 1).count(),
        cocktails.stream().filter(c -> c.favorite()).count());
  }
}
