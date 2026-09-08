package com.barbuddy.inventory;

import com.barbuddy.shared.errors.ApiProblemResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/v1/inventory", produces = "application/json")
@SecurityRequirement(name = "bearerAuth")
@ApiResponse(
    responseCode = "401",
    description = "Authentication required",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
@ApiResponse(
    responseCode = "400",
    description = "Invalid inventory input",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
@ApiResponse(
    responseCode = "404",
    description = "Inventory item not found",
    content =
        @Content(
            mediaType = "application/problem+json",
            schema = @Schema(implementation = ApiProblemResponse.class)))
public class InventoryController {
  private final InventoryService service;

  InventoryController(InventoryService service) {
    this.service = service;
  }

  @GetMapping
  @ApiResponse(responseCode = "200", description = "Your inventory")
  public List<InventoryResponse> listInventory(@AuthenticationPrincipal Jwt jwt) {
    return service.list(jwt.getSubject());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @ApiResponse(responseCode = "201", description = "Inventory item created")
  public InventoryResponse createInventory(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody InventoryRequests.CreateInventory input) {
    return service.create(jwt.getSubject(), input);
  }

  @PatchMapping("/{id}")
  @ApiResponse(responseCode = "200", description = "Inventory item updated")
  public InventoryResponse updateInventory(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody InventoryRequests.UpdateInventory input) {
    return service.update(jwt.getSubject(), id, input);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @ApiResponse(responseCode = "204", description = "Inventory item removed", content = @Content)
  public void deleteInventory(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    service.delete(jwt.getSubject(), id);
  }
}
