package com.barbuddy.catalog;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogImportService {
  private final CatalogImportRepository repository;

  CatalogImportService(CatalogImportRepository repository) {
    this.repository = repository;
  }

  @Transactional
  public void importCatalog(CatalogInput input) {
    repository.lockImports();
    var ingredientIds = new HashSet<String>();
    var cocktailSlugs = new HashMap<String, String>();
    var recipeCocktails = new HashMap<String, String>();
    for (var ingredient : input.document().get("ingredients"))
      ingredientIds.add(ingredient.get("id").asText());
    for (var cocktail : input.document().get("cocktails")) {
      String id = cocktail.get("id").asText();
      cocktailSlugs.put(id, cocktail.get("slug").asText());
      for (var recipe : cocktail.get("recipes")) recipeCocktails.put(recipe.get("id").asText(), id);
    }
    for (String id : repository.ingredientIds()) {
      if (!ingredientIds.contains(id)) throw missing(id);
    }
    checkCompatibility(repository.cocktailSlugs(), cocktailSlugs, "cocktail slug");
    checkCompatibility(repository.recipeCocktails(), recipeCocktails, "recipe cocktail");
    repository.synchronize(input.json());
  }

  private void checkCompatibility(
      Map<String, String> existing, Map<String, String> incoming, String field) {
    existing.forEach(
        (id, value) -> {
          if (!incoming.containsKey(id)) throw missing(id);
          if (!value.equals(incoming.get(id))) {
            throw new IllegalArgumentException(
                "Cannot change " + field + " for " + id + "; use a reviewed identity migration");
          }
        });
  }

  private IllegalArgumentException missing(String id) {
    return new IllegalArgumentException(
        "Catalog omits existing identity " + id + "; retirement requires a reviewed migration");
  }
}
