package com.barbuddy.users;

import com.barbuddy.shared.security.AuthProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AuthAccountAdmin {
  private final String issuer;
  private final String secret;
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public AuthAccountAdmin(
      AuthProperties auth, @Value("${bar-buddy.account-deletion.admin-key:}") String secret) {
    this.issuer = auth.issuer();
    this.secret = secret;
  }

  public boolean available() {
    return secret != null && !secret.isBlank() && issuer != null && issuer.startsWith("https://");
  }

  public void delete(String subject) {
    if (!available()) throw new IllegalStateException("Account deletion is not configured");
    // Subjects originate in a verified JWT. Still constrain the administrative path to one UUID.
    String id = UUID.fromString(subject).toString();
    var request =
        HttpRequest.newBuilder(URI.create(issuer.replaceAll("/$", "") + "/admin/users/" + id))
            .timeout(Duration.ofSeconds(10))
            .header("apikey", secret)
            .header("Authorization", "Bearer " + secret)
            .DELETE()
            .build();
    try {
      int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
      if ((status < 200 || status >= 300) && status != 404)
        throw new IllegalStateException("Identity deletion failed with HTTP " + status);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Identity deletion interrupted");
    } catch (java.io.IOException exception) {
      throw new IllegalStateException("Identity deletion unavailable");
    }
  }
}
