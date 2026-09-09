package com.barbuddy.cocktails;

import com.barbuddy.users.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;

@Entity
@Table(
    name = "user_cocktail_state",
    uniqueConstraints =
        @UniqueConstraint(
            name = "user_cocktail_state_owner_cocktail_unique",
            columnNames = {"owner_user_id", "cocktail_id"}))
public class UserCocktailState {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "owner_user_id", nullable = false, updatable = false)
  private AppUser owner;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "cocktail_id", nullable = false, updatable = false)
  private Cocktail cocktail;

  @Column(name = "favorite", nullable = false)
  private boolean favorite;

  protected UserCocktailState() {}

  public UUID getId() {
    return id;
  }

  public AppUser getOwner() {
    return owner;
  }

  public Cocktail getCocktail() {
    return cocktail;
  }

  public boolean isFavorite() {
    return favorite;
  }
}
