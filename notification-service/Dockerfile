# Production JRE Runtime for Spring Boot Notification Service
FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app

# Run as non-privileged user for container security
RUN addgroup -S sanitigo && adduser -S sanitigo -G sanitigo

# Copy compiled executable JAR from target
COPY target/sanitigo-notification-service-*.jar app.jar
RUN chown sanitigo:sanitigo app.jar

USER sanitigo

# Default JVM container ergonomics tuned for container limits
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["java", "-jar", "app.jar"]

