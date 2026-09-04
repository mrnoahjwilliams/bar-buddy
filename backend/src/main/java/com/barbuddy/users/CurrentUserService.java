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
  public AppUser resolve(String authSubject) {
    users.insertIfAbsent(UUID.randomUUID(), authSubject);
    return users
        .findByAuthSubject(authSubject)
        .orElseThrow(() -> new IllegalStateException("Authenticated user could not be resolved"));
  }
}
