package com.barbuddy.users;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface AppUserRepository extends JpaRepository<AppUser, UUID> {
  Optional<AppUser> findByAuthSubject(String authSubject);

  @Modifying
  @Query(
      value =
          "insert into app_user (id, auth_subject) values (:id, :authSubject) "
              + "on conflict (auth_subject) do nothing",
      nativeQuery = true)
  int insertIfAbsent(@Param("id") UUID id, @Param("authSubject") String authSubject);
}
