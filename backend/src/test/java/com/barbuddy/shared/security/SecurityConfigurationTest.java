package com.barbuddy.shared.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.users.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest
@Import({SecurityConfiguration.class, JwtConfiguration.class})
class SecurityConfigurationTest {
  @Autowired MockMvc mvc;
  @MockitoBean CurrentUserService currentUserService;

  @Test
  void anonymousRequestsCannotAccessApplicationOrDocs() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
    mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/login")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser
  void authenticatedApplicationRequestsReachMvcButOtherRoutesStayDenied() throws Exception {
    mvc.perform(get("/api/v1/not-implemented")).andExpect(status().isNotFound());
    mvc.perform(get("/v3/api-docs")).andExpect(status().isForbidden());
  }
}
