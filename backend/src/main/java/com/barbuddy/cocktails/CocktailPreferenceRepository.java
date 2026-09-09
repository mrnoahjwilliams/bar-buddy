package com.barbuddy.cocktails;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CocktailPreferenceRepository extends JpaRepository<UserCocktailState, UUID> {
  @Query(
      "select s.cocktail.id from UserCocktailState s where s.owner.authSubject = :subject and s.favorite = true and s.cocktail.id in :cocktails")
  List<UUID> favoriteCocktailIds(
      @Param("cocktails") List<UUID> cocktails, @Param("subject") String subject);

  @Modifying
  @Query(
      value =
          "insert into user_cocktail_state (id, owner_user_id, cocktail_id, favorite) "
              + "values (:id, :owner, :cocktail, :favorite) "
              + "on conflict (owner_user_id, cocktail_id) do update set favorite = excluded.favorite",
      nativeQuery = true)
  int upsert(
      @Param("id") UUID id,
      @Param("owner") UUID owner,
      @Param("cocktail") UUID cocktail,
      @Param("favorite") boolean favorite);
}
