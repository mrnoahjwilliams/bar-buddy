package com.barbuddy.home;

import com.barbuddy.shared.errors.ApiProblemResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@SecurityRequirement(name = "bearerAuth")
public class HomeController {
  private final HomeService service;

  HomeController(HomeService service) {
    this.service = service;
  }

  @ApiResponse(responseCode = "200", description = "Current user's bar summary")
  @ApiResponse(
      responseCode = "401",
      description = "Authentication is required",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ApiProblemResponse.class)))
  @GetMapping(value = "/api/v1/home", produces = "application/json")
  public HomeSummary getHomeSummary(@AuthenticationPrincipal Jwt jwt) {
    return service.summary(jwt.getSubject());
  }
}
