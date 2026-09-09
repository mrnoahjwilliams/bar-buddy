package com.barbuddy.cocktails;

import jakarta.validation.constraints.NotNull;

public final class CocktailPreferenceRequests {
  private CocktailPreferenceRequests() {}

  public record UpdateCocktailPreference(@NotNull Boolean favorite) {}
}
