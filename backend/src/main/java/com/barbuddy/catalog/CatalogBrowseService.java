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
import java.util.concurrent.ThreadLocalRandom;
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
      UUID ingredientId,
      String availability,
      boolean favoritesOnly,
      String subject) {
    return cocktails(
        search,
        primarySpiritId,
        ingredientId,
        availability,
        favoritesOnly,
        CatalogDiscovery.defaults(),
        subject);
  }

  public List<CocktailSummary> cocktails(
      String search,
      UUID primarySpiritId,
      UUID ingredientId,
      String availability,
      boolean favoritesOnly,
      CatalogDiscovery discovery,
      String subject) {
    if (primarySpiritId != null) {
      var ingredient = repository.ingredient(primarySpiritId);
      if (ingredient == null || !ingredient.getCategory().equals("spirit"))
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Primary spirit must identify a catalog spirit.");
    }
    if (ingredientId != null && repository.ingredient(ingredientId) == null)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Ingredient must identify a catalog ingredient.");
    String filter = availability == null || availability.isBlank() ? "all" : availability.strip();
    if (!Set.of("all", "can_make", "one_away").contains(filter))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown availability filter.");
    return summaries(
            repository.cocktails(
                search(search), primarySpiritId, ingredientId, favoritesOnly, discovery, subject),
            subject,
            ingredientId)
        .stream()
        .filter(
            c ->
                filter.equals("all")
                    || (filter.equals("can_make")
                        ? c.availability().canMake()
                        : c.availability().missingCount() == 1))
        .sorted(order(discovery.sort()))
        .map(c -> c.withMatchedAlias(matchedAlias(c, search(search))))
        .toList();
  }

  public CocktailSummary randomCocktail(
      String search,
      UUID primarySpiritId,
      UUID ingredientId,
      String availability,
      boolean favoritesOnly,
      String subject) {
    return randomCocktail(
        search,
        primarySpiritId,
        ingredientId,
        availability,
        favoritesOnly,
        CatalogDiscovery.defaults(),
        subject);
  }

  public CocktailSummary randomCocktail(
      String search,
      UUID primarySpiritId,
      UUID ingredientId,
      String availability,
      boolean favoritesOnly,
      CatalogDiscovery discovery,
      String subject) {
    var candidates =
        cocktails(
            search, primarySpiritId, ingredientId, availability, favoritesOnly, discovery, subject);
    if (candidates.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No matching cocktails.");
    return candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
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
        summary.favorite(),
        summary.styles(),
        summary.tags(),
        summary.alcoholFree(),
        summary.ingredientCount());
  }

  private List<CocktailSummary> summaries(List<Cocktail> cocktails, String subject) {
    return summaries(cocktails, subject, null);
  }

  private List<CocktailSummary> summaries(
      List<Cocktail> cocktails, String subject, UUID matchedIngredientId) {
    if (cocktails.isEmpty()) return List.of();
    var cocktailIds = cocktails.stream().map(Cocktail::getId).toList();
    var missing = new HashMap<UUID, List<IngredientSummary>>();
    var counts = new HashMap<UUID, Integer>();
    for (var row : repository.requiredIngredients(cocktailIds, subject)) {
      counts.merge((UUID) row[0], 1, Integer::sum);
      if (Boolean.TRUE.equals(row[4])) continue;
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
                    favorites.contains(c.getId()),
                    matchedIngredientId,
                    counts.getOrDefault(c.getId(), 0)))
        .toList();
  }

  private static Comparator<CocktailSummary> order(String sort) {
    Comparator<CocktailSummary> names =
        Comparator.comparing((CocktailSummary c) -> c.name().toLowerCase(Locale.ROOT))
            .thenComparing(CocktailSummary::id);
    if (sort.equals("availability"))
      return Comparator.comparingInt((CocktailSummary c) -> c.availability().missingCount())
          .thenComparing(names);
    Comparator<CocktailSummary> within =
        sort.equals("ingredient_count")
            ? Comparator.comparingInt(CocktailSummary::ingredientCount).thenComparing(names)
            : names;
    return Comparator.comparingInt(
            (CocktailSummary c) -> Math.min(2, c.availability().missingCount()))
        .thenComparing(within);
  }

  private static String matchedAlias(CocktailSummary cocktail, String search) {
    return normalize(cocktail.name()).contains(search)
        ? null
        : cocktail.aliases().stream()
            .filter(alias -> normalize(alias).contains(search))
            .findFirst()
            .orElse(null);
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
