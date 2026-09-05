package com.barbuddy.catalog;

import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;

/** Explicit operator entry point: no HTTP listener, authentication flow, or startup import. */
@EnableAutoConfiguration
@Import({CatalogImportService.class, CatalogImportRepository.class})
public class CatalogImportApplication {
  public static void main(String[] args) throws Exception {
    if (args.length != 1)
      throw new IllegalArgumentException("Usage: CatalogImportApplication <catalog.json>");
    CatalogInput input = CatalogInput.read(Path.of(args[0]));
    SpringApplication application = new SpringApplication(CatalogImportApplication.class);
    application.setWebApplicationType(WebApplicationType.NONE);
    try (var context = application.run()) {
      context.getBean(CatalogImportService.class).importCatalog(input);
      System.out.println("Catalog import completed successfully.");
    }
  }
}
