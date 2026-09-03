package com.barbuddy.shared.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest
@Import(SecurityConfiguration.class)
class SecurityConfigurationTest {
  @Autowired MockMvc mvc;

  @Test
  void anonymousRequestsCannotAccessApplicationOrDocs() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
    mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/login")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser
  void evenAuthenticatedRequestsAreDeniedUntilIdentityIsImplemented() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/inventory").with(csrf())).andExpect(status().isForbidden());
  }
}
