package com.barbuddy.catalog;

import com.barbuddy.shared.errors.ApiProblemResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = CatalogBrowseController.class)
public class CatalogBrowseErrors {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<ApiProblemResponse> domain(
      ResponseStatusException error, HttpServletRequest request) {
    return problem(HttpStatus.valueOf(error.getStatusCode().value()), error.getReason(), request);
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ResponseEntity<ApiProblemResponse> invalidParameter(HttpServletRequest request) {
    return problem(HttpStatus.BAD_REQUEST, "Invalid catalog parameter.", request);
  }

  private ResponseEntity<ApiProblemResponse> problem(
      HttpStatus status, String detail, HttpServletRequest request) {
    return ResponseEntity.status(status)
        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
        .body(
            new ApiProblemResponse(
                URI.create("about:blank"),
                status.getReasonPhrase(),
                status.value(),
                detail,
                URI.create(request.getRequestURI())));
  }
}
