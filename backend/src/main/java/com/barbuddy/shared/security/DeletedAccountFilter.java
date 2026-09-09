package com.barbuddy.shared.security;

import com.barbuddy.shared.errors.ApiProblemWriter;
import com.barbuddy.users.AccountDeletionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.filter.OncePerRequestFilter;

class DeletedAccountFilter extends OncePerRequestFilter {
  private final AccountDeletionService deletions;
  private final ApiProblemWriter problems;

  DeletedAccountFilter(AccountDeletionService deletions, ApiProblemWriter problems) {
    this.deletions = deletions;
    this.problems = problems;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null
        && auth.getPrincipal() instanceof Jwt jwt
        && deletions.requested(jwt.getSubject())) {
      if (request.getMethod().equals("DELETE") && request.getRequestURI().equals("/api/v1/me")) {
        response.setStatus(HttpStatus.ACCEPTED.value());
      } else {
        problems.write(
            request, response, HttpStatus.UNAUTHORIZED, "This account has been deleted.");
      }
      return;
    }
    chain.doFilter(request, response);
  }
}
