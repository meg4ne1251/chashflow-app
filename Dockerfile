# ============================================
# Stage 1: Build backend (Kotlin/Ktor Fat JAR)
# ============================================
FROM eclipse-temurin:25-jdk-alpine AS backend-build

WORKDIR /build

# Cache Gradle dependencies
COPY gradle/ gradle/
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY shared/build.gradle.kts shared/build.gradle.kts
COPY backend/build.gradle.kts backend/build.gradle.kts
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon 2>/dev/null || true

# Copy source and build
COPY shared/ shared/
COPY backend/ backend/
RUN ./gradlew :backend:jar --no-daemon

# ============================================
# Stage 2: Production runtime
# ============================================
FROM eclipse-temurin:25-jre-alpine

RUN apk add --no-cache curl tini font-noto-cjk \
    && addgroup -S app \
    && adduser -S app -G app

WORKDIR /app

COPY --from=backend-build /build/backend/build/libs/backend-1.0.0.jar app.jar

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["java", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=75.0", \
     "-jar", "app.jar"]
