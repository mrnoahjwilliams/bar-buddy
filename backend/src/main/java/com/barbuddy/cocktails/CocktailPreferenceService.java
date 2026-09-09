package com.barbuddy.cocktails;

import com.barbuddy.catalog.CatalogBrowseRepository;
import com.barbuddy.users.CurrentUserService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class CocktailPreferenceService {
  private final CocktailPreferenceRepository preferences;
  private final CatalogBrowseRepository catalog;
  private final CurrentUserService users;

  CocktailPreferenceService(
      CocktailPreferenceRepository preferences,
      CatalogBrowseRepository catalog,
      CurrentUserService users) {
    this.preferences = preferences;
    this.catalog = catalog;
    this.users = users;
  }

  public CocktailPreferenceResponse update(
      String subject, UUID cocktailId, CocktailPreferenceRequests.UpdateCocktailPreference input) {
    if (catalog.cocktail(cocktailId) == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cocktail not found.");
    var owner = users.resolve(subject);
    preferences.upsert(UUID.randomUUID(), owner.getId(), cocktailId, input.favorite());
    return new CocktailPreferenceResponse(cocktailId, input.favorite());
  }
}
