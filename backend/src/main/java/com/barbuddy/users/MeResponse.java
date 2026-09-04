package com.barbuddy.users;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

public record MeResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
  static MeResponse from(AppUser user) {
    return new MeResponse(user.getId(), user.getCreatedAt());
  }
}
