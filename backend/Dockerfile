# Build from backend/; CI runs full verification before an operator deploys.
FROM eclipse-temurin:25.0.2_10-jdk-jammy AS build
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw
COPY checkstyle.xml ./
COPY src/ src/
COPY catalog/scripts/ catalog/scripts/
RUN ./mvnw --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:25.0.2_10-jre-jammy AS runtime
WORKDIR /app
RUN groupadd --gid 10001 barbuddy && useradd --uid 10001 --gid barbuddy --no-create-home barbuddy
COPY --from=build --chown=10001:10001 /build/target/bar-buddy-0.0.1-SNAPSHOT.jar app.jar
USER 10001:10001
ENV SPRING_PROFILES_ACTIVE=production
ENV JAVA_TOOL_OPTIONS="-Xmx256m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -Xss512k"
EXPOSE 10000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
