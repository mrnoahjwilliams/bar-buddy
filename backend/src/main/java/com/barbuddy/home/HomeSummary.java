package com.barbuddy.home;

public record HomeSummary(
    long haveItems,
    long outItems,
    long availableIngredients,
    long canMake,
    long oneAway,
    long favorites) {}
