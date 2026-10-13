package com.barbuddy.catalog;

import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Optional discovery inputs, normalized before querying. */
public record CatalogDiscovery(String style, String tag, String alcohol, String sort) {
  private static final Set<String> STYLES =
      Set.of(
          "old-fashioned",
          "martini",
          "manhattan",
          "negroni",
          "sour",
          "daisy",
          "collins",
          "fizz",
          "highball",
          "spritz",
          "julep",
          "smash",
          "swizzle",
          "cobbler",
          "flip",
          "punch",
          "duo-and-trio",
          "tiki");
  private static final Set<String> TAGS =
      Set.of(
          "refreshing",
          "creamy",
          "coffee",
          "sparkling",
          "spring",
          "summer",
          "autumn",
          "winter",
          "brunch",
          "aperitif",
          "after-dinner",
          "celebration");

  public CatalogDiscovery {
    style = value(style, STYLES, null, "style");
    tag = value(tag, TAGS, null, "tag");
    alcohol = value(alcohol, Set.of("all", "alcohol_free", "alcoholic"), "all", "alcohol filter");
    sort =
        value(
            sort,
            Set.of("availability", "alphabetical", "ingredient_count"),
            "availability",
            "sort");
  }

  public static CatalogDiscovery defaults() {
    return new CatalogDiscovery(null, null, null, null);
  }

  private static String value(String value, Set<String> allowed, String fallback, String label) {
    if (value == null || value.isBlank()) return fallback;
    String normalized = value.strip();
    if (!allowed.contains(normalized))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown cocktail " + label + ".");
    return normalized;
  }
}
