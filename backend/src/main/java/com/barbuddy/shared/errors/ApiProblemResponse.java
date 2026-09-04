package com.barbuddy.shared.errors;

import io.swagger.v3.oas.annotations.media.Schema;
import java.net.URI;

public record ApiProblemResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) URI type,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int status,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String detail,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) URI instance) {}
