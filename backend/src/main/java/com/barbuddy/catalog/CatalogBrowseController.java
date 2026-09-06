package com.barbuddy.catalog;

import com.barbuddy.catalog.CatalogResponses.CocktailDetail;
import com.barbuddy.catalog.CatalogResponses.CocktailSummary;
import com.barbuddy.catalog.CatalogResponses.IngredientDetail;
import com.barbuddy.catalog.CatalogResponses.IngredientSummary;
import com.barbuddy.shared.errors.ApiProblemResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/v1", produces = "application/json")
@SecurityRequirement(name = "bearerAuth")
@ApiResponse(
    responseCode = "401",
    description = "Authentication is required",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
@ApiResponse(
    responseCode = "400",
    description = "Invalid catalog input",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
@ApiResponse(
    responseCode = "404",
    description = "Catalog item not found",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
public class CatalogBrowseController {
  private final CatalogBrowseService service;

  CatalogBrowseController(CatalogBrowseService service) {
    this.service = service;
  }

  @ApiResponse(responseCode = "200", description = "Catalog result")
  @GetMapping("/ingredients")
  public List<IngredientSummary> listIngredients(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String category) {
    return service.ingredients(search, category);
  }

  @ApiResponse(responseCode = "200", description = "Catalog result")
  @GetMapping("/ingredients/{id}")
  public IngredientDetail getIngredient(@PathVariable UUID id) {
    return service.ingredient(id);
  }

  @ApiResponse(responseCode = "200", description = "Catalog result")
  @GetMapping("/cocktails")
  public List<CocktailSummary> listCocktails(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) UUID primarySpiritId) {
    return service.cocktails(search, primarySpiritId);
  }

  @ApiResponse(responseCode = "200", description = "Catalog result")
  @GetMapping("/cocktails/{id}")
  public CocktailDetail getCocktail(@PathVariable UUID id) {
    return service.cocktail(id);
  }
}
