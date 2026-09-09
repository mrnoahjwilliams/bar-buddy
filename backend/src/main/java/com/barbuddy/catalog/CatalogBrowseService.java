package com.barbuddy.catalog;

import com.barbuddy.catalog.CatalogResponses.AvailabilityResult;
import com.barbuddy.catalog.CatalogResponses.CocktailDetail;
import com.barbuddy.catalog.CatalogResponses.CocktailSummary;
import com.barbuddy.catalog.CatalogResponses.IngredientDetail;
import com.barbuddy.catalog.CatalogResponses.IngredientSummary;
import com.barbuddy.catalog.CatalogResponses.RecipeDetail;
import com.barbuddy.catalog.CatalogResponses.RecipeLine;
import com.barbuddy.cocktails.Cocktail;
import com.barbuddy.cocktails.CocktailPreferenceRepository;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CatalogBrowseService {
  private static final Set<String> CATEGORIES =
      Set.of(
          "spirit",
          "liqueur",
          "fortified_wine",
          "bitters",
          "syrup",
          "juice",
          "mixer",
          "fruit",
          "herb",
          "garnish",
          "other");
  private final CatalogBrowseRepository repository;
  private final CocktailPreferenceRepository preferences;

  CatalogBrowseService(
      CatalogBrowseRepository repository, CocktailPreferenceRepository preferences) {
    this.repository = repository;
    this.preferences = preferences;
  }

  public List<IngredientSummary> ingredients(String search, String category) {
    String normalizedCategory = category == null || category.isBlank() ? null : category.strip();
    if (normalizedCategory != null && !CATEGORIES.contains(normalizedCategory))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown ingredient category.");
    String query = search(search);
    return repository.ingredients(query, normalizedCategory).stream()
        .map(
            i ->
                new IngredientSummary(
                    i.getId(),
                    i.getName(),
                    i.getCategory(),
                    normalize(i.getName()).contains(query)
                        ? null
                        : Arrays.stream(i.getAliases())
                            .filter(a -> normalize(a).contains(query))
                            .findFirst()
                            .orElse(null)))
        .toList();
  }

  public List<CocktailSummary> cocktails(
      String search,
      UUID primarySpiritId,
      String availability,
      boolean favoritesOnly,
      String subject) {
    if (primarySpiritId != null) {
      var ingredient = repository.ingredient(primarySpiritId);
      if (ingredient == null || !ingredient.getCategory().equals("spirit"))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Primary spirit must identify a catalog spirit.");
    }
    String filter = availability == null || availability.isBlank() ? "all" : availability.strip();
    if (!Set.of("all", "can_make", "one_away").contains(filter))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown availability filter.");
    return summaries(
            repository.cocktails(search(search), primarySpiritId, favoritesOnly, subject), subject)
        .stream()
        .filter(
            c ->
                filter.equals("all")
                    || (filter.equals("can_make")
                        ? c.availability().canMake()
                        : c.availability().missingCount() == 1))
        .sorted(
            Comparator.comparingInt((CocktailSummary c) -> c.availability().missingCount())
                .thenComparing(c -> c.name().toLowerCase(Locale.ROOT))
                .thenComparing(CocktailSummary::id))
        .toList();
  }

  public IngredientDetail ingredient(UUID id, String subject) {
    var ingredient = repository.ingredient(id);
    if (ingredient == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ingredient not found.");
    var related = summaries(repository.related(id), subject);
    return new IngredientDetail(
        id, ingredient.getName(), ingredient.getCategory(), related.size(), related);
  }

  public CocktailDetail cocktail(UUID id, String subject) {
    var cocktail = repository.cocktail(id);
    if (cocktail == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cocktail not found.");
    var recipe = repository.recipe(id);
    var detail =
        new RecipeDetail(
            recipe.getId(),
            recipe.getName(),
            recipe.getInstructions(),
            recipe.getGlassware(),
            recipe.getGarnish(),
            repository.lines(recipe.getId()).stream().map(RecipeLine::from).toList());
    var summary = summaries(List.of(cocktail), subject).getFirst();
    return new CocktailDetail(
        id,
        summary.name(),
        summary.slug(),
        summary.primarySpirit(),
        detail,
        summary.availability(),
        summary.favorite());
  }

  private List<CocktailSummary> summaries(List<Cocktail> cocktails, String subject) {
    if (cocktails.isEmpty()) return List.of();
    var cocktailIds = cocktails.stream().map(Cocktail::getId).toList();
    var missing = new HashMap<UUID, List<IngredientSummary>>();
    for (var row : repository.missingIngredients(cocktailIds, subject)) {
      missing
          .computeIfAbsent((UUID) row[0], key -> new ArrayList<>())
          .add(new IngredientSummary((UUID) row[1], (String) row[2], (String) row[3], null));
    }
    var favorites = Set.copyOf(preferences.favoriteCocktailIds(cocktailIds, subject));
    return cocktails.stream()
        .map(
            c ->
                CocktailSummary.from(
                    c,
                    AvailabilityResult.from(missing.getOrDefault(c.getId(), List.of())),
                    favorites.contains(c.getId())))
        .toList();
  }

  private static String normalize(String value) {
    return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
        .replaceAll("[\\u0300-\\u036f]", "");
  }

  private static String search(String value) {
    if (value != null && value.length() > 200)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Search must be at most 200 characters.");
    return value == null ? "" : normalize(value.strip());
  }
}
