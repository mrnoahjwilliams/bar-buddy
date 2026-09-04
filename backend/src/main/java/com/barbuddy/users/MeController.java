package com.barbuddy.users;

import com.barbuddy.shared.errors.ApiProblemResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Users")
public class MeController {
  private final CurrentUserService currentUserService;

  MeController(CurrentUserService currentUserService) {
    this.currentUserService = currentUserService;
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
