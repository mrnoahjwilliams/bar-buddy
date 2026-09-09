package com.barbuddy.users;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfile(
    @NotNull @Size(max = 80) @Pattern(regexp = "[^\\p{Cntrl}]*") String displayName) {}
