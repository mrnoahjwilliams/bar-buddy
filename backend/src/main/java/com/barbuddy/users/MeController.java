package com.barbuddy.users;

import com.barbuddy.shared.errors.ApiProblemResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Users")
public class MeController {
  private final CurrentUserService currentUserService;
  private final AccountDeletionService deletions;

  MeController(CurrentUserService currentUserService, AccountDeletionService deletions) {
    this.currentUserService = currentUserService;
    this.deletions = deletions;
  }

  @org.springframework.web.bind.annotation.DeleteMapping
  @org.springframework.web.bind.annotation.ResponseStatus(
      org.springframework.http.HttpStatus.ACCEPTED)
  @Operation(summary = "Permanently delete your account and queue identity removal")
  @SecurityRequirement(name = "bearerAuth")
  public void deleteAccount(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DeleteAccount request) {
    deletions.request(jwt.getSubject());
  }

  public record DeleteAccount(
      @jakarta.validation.constraints.NotNull
          @jakarta.validation.constraints.Pattern(regexp = "DELETE")
          String confirmation) {}

  @PutMapping(
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(summary = "Update your profile")
  @SecurityRequirement(name = "bearerAuth")
  public MeResponse updateProfile(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfile request) {
    return MeResponse.from(
        currentUserService.updateProfile(jwt.getSubject(), request.displayName()));
  }

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(summary = "Resolve the current Bar Buddy user")
  @ApiResponse(
      responseCode = "200",
      description = "The current Bar Buddy user",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON_VALUE,
              schema = @Schema(implementation = MeResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "Authentication is required",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
              schema = @Schema(implementation = ApiProblemResponse.class)))
  @SecurityRequirement(name = "bearerAuth")
  public MeResponse getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
    return MeResponse.from(currentUserService.resolve(jwt.getSubject()));
  }
}
