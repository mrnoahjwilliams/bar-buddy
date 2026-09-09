package com.barbuddy.cocktails;

import java.util.UUID;

public record CocktailPreferenceResponse(UUID cocktailId, boolean favorite) {}
