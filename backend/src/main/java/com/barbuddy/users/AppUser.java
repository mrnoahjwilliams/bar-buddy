package com.barbuddy.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class AppUser {
  @Id private UUID id;

  @Column(name = "auth_subject", nullable = false, unique = true, updatable = false, length = 255)
  private String authSubject;

  @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "display_name", length = 80)
  private String displayName;

  @Column(name = "deletion_requested_at")
  private Instant deletionRequestedAt;

  public boolean isDeletionRequested() {
    return deletionRequestedAt != null;
  }

  protected AppUser() {}

  public String getDisplayName() {
    return displayName;
  }

  void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public UUID getId() {
    return id;
  }

  public String getAuthSubject() {
    return authSubject;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
