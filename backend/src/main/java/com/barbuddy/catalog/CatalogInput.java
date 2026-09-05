package com.barbuddy.catalog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Validates a snapshot using the same versioned validator as catalog maintenance. */
public final class CatalogInput {
  private final String json;
  private final JsonNode document;

  private CatalogInput(String json) {
    this.json = json;
    this.document = new JsonMapper().readTree(json);
  }

  public static CatalogInput read(Path input) throws IOException, InterruptedException {
    String snapshot = Files.readString(input);
    Path directory = Files.createTempDirectory("bar-buddy-catalog-");
    try {
      for (String resource : new String[] {"catalog-validator.mjs", "validate-catalog.mjs"}) {
        try (var stream = CatalogInput.class.getResourceAsStream("/catalog-tools/" + resource)) {
          if (stream == null)
            throw new IOException("Missing bundled catalog validator: " + resource);
          Files.copy(stream, directory.resolve(resource));
        }
      }
      Path copy = directory.resolve("input.json");
      Files.writeString(copy, snapshot);
      Path output = directory.resolve("validation.log");
      Process process =
          new ProcessBuilder(
                  "node", directory.resolve("validate-catalog.mjs").toString(), copy.toString())
              .redirectErrorStream(true)
              .redirectOutput(output.toFile())
              .start();
      try {
        if (process.waitFor() != 0) {
          throw new IllegalArgumentException(
              Files.readString(output).replace(copy.toString(), input.toString()));
        }
      } finally {
        if (process.isAlive()) process.destroyForcibly().waitFor();
      }
      return new CatalogInput(snapshot);
    } finally {
      try (var files = Files.list(directory)) {
        for (Path file : files.toList()) Files.deleteIfExists(file);
      }
      Files.deleteIfExists(directory);
    }
  }

  String json() {
    return json;
  }

  JsonNode document() {
    return document;
  }
}
