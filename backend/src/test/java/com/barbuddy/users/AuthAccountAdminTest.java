package com.barbuddy.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.barbuddy.shared.security.AuthProperties;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class AuthAccountAdminTest {
  @Test
  void hardDeletesOnlyTheRequestedIdentityAndAcceptsAlreadyDeletedUsers() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var status = new AtomicInteger(204);
    var path = new AtomicReference<String>();
    var method = new AtomicReference<String>();
    var key = new AtomicReference<String>();
    server.createContext(
        "/auth/v1/admin/users/",
        exchange -> {
          path.set(exchange.getRequestURI().getPath());
          method.set(exchange.getRequestMethod());
          key.set(exchange.getRequestHeaders().getFirst("apikey"));
          exchange.sendResponseHeaders(status.get(), -1);
          exchange.close();
        });
    server.start();
    try {
      var properties =
          new AuthProperties(
              false, "http://127.0.0.1:" + server.getAddress().getPort() + "/auth/v1", "", "");
      var admin =
          new AuthAccountAdmin(properties, "test-only-secret") {
            @Override
            public boolean available() {
              return true;
            }
          };
      String subject = UUID.randomUUID().toString();
      admin.delete(subject);
      assertThat(path.get()).isEqualTo("/auth/v1/admin/users/" + subject);
      assertThat(method.get()).isEqualTo("DELETE");
      assertThat(key.get()).isEqualTo("test-only-secret");
      status.set(404);
      admin.delete(subject);
      status.set(503);
      assertThatThrownBy(() -> admin.delete(subject))
          .isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("503");
      assertThatThrownBy(() -> admin.delete("../other"))
          .isInstanceOf(IllegalArgumentException.class);
    } finally {
      server.stop(0);
    }
  }

  @Test
  void requiresAServerCredentialAndSecureIssuer() {
    assertThat(
            new AuthAccountAdmin(new AuthProperties(false, "https://auth.test/auth/v1", "", ""), "")
                .available())
        .isFalse();
    assertThat(
            new AuthAccountAdmin(
                    new AuthProperties(false, "http://auth.test/auth/v1", "", ""), "secret")
                .available())
        .isFalse();
  }
}
