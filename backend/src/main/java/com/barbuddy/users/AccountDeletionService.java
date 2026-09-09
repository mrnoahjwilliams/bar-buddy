package com.barbuddy.users;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
  private final JdbcTemplate jdbc;
  private final CurrentUserService users;
  private final AuthAccountAdmin authAdmin;

  public AccountDeletionService(
      JdbcTemplate jdbc, CurrentUserService users, AuthAccountAdmin authAdmin) {
    this.jdbc = jdbc;
    this.users = users;
    this.authAdmin = authAdmin;
  }

  public boolean requested(String subject) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "select exists(select 1 from app_user where auth_subject = ? and deletion_requested_at is not null)",
            Boolean.class,
            subject));
  }

  @Transactional
  public void request(String subject) {
    if (!authAdmin.available())
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Account deletion is temporarily unavailable. Please try again later.");
    var user = users.resolve(subject);
    jdbc.update("delete from inventory_item where owner_user_id = ?", user.getId());
    jdbc.update("delete from user_cocktail_state where owner_user_id = ?", user.getId());
    jdbc.update(
        "update app_user set display_name = null, deletion_requested_at = current_timestamp where id = ?",
        user.getId());
  }

  public List<String> pending() {
    return jdbc.queryForList(
        "select auth_subject from app_user where deletion_requested_at is not null and identity_deleted_at is null order by deletion_requested_at limit 25",
        String.class);
  }

  public void finish(String subject) {
    authAdmin.delete(subject);
    jdbc.update(
        "update app_user set identity_deleted_at = current_timestamp where auth_subject = ? and deletion_requested_at is not null",
        subject);
  }
}
