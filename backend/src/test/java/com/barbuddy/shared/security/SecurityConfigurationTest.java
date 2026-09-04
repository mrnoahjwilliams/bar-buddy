package com.barbuddy.shared.security;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.barbuddy.shared.errors.ApiProblemWriter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = SecurityConfigurationTest.TestController.class)
@Import({
  ApiProblemWriter.class,
  JwtConfiguration.class,
  SecurityConfiguration.class,
  SecurityConfigurationTest.TestController.class
})
class SecurityConfigurationTest {
  @Autowired MockMvc mvc;

  @Test
  void anonymousRequestsCannotAccessApplicationOrDocs() throws Exception {
    mvc.perform(get("/api/v1/test"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(jsonPath("$.detail").value("Authentication is required."))
        .andExpect(jsonPath("$.instance").value("/api/v1/test"));
    mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/login")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser
  void authenticatedApplicationRequestsReachMvcButOtherRoutesStayDenied() throws Exception {
    mvc.perform(get("/api/v1/test")).andExpect(status().isOk());
    mvc.perform(get("/v3/api-docs")).andExpect(status().isForbidden());
  }

  @RestController
  public static class TestController {
    @GetMapping("/api/v1/test")
    void testEndpoint() {}
  }
}
