package com.barbuddy.users;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
  private final AppUserRepository users;

  CurrentUserService(AppUserRepository users) {
    this.users = users;
  }

  @Transactional
  public AppUser updateProfile(String authSubject, String displayName) {
    var user = resolve(authSubject);
    var normalized = displayName.strip();
    user.setDisplayName(normalized.isEmpty() ? null : normalized);
    return user;
  }

  @Transactional
  public AppUser resolve(String authSubject) {
    users.insertIfAbsent(UUID.randomUUID(), authSubject);
    var user =
        users
            .findByAuthSubject(authSubject)
            .orElseThrow(
                () -> new IllegalStateException("Authenticated user could not be resolved"));
    if (user.isDeletionRequested())
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.UNAUTHORIZED, "This account has been deleted.");
    return user;
  }
}
