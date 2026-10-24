package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class EventProcessingService {

    private static final Logger log =
            LoggerFactory.getLogger(EventProcessingService.class);

    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;
    private final NotificationWriter notificationWriter;
    private final EmailNotificationService emailNotificationService;

    public EventProcessingService(
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate,
            NotificationWriter notificationWriter,
            EmailNotificationService emailNotificationService) {
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.notificationWriter = notificationWriter;
        this.emailNotificationService = emailNotificationService;
    }

    @Transactional
    public void process(byte[] message) throws Exception {
        JsonNode event = objectMapper.readTree(message);

        String eventId = requiredText(event, "eventId");
        String eventType = requiredText(event, "eventType");
        requiredText(event, "occurredAt");
        requiredVersion(event, "version");

        log.info(
            "[Consumer:Processing] Starting eventId={}, eventType={}",
            eventId, eventType
        );

        JsonNode data = event.get("data");

        if (data == null || !data.isObject()) {
            throw new IllegalArgumentException(
                "Event must contain a data object"
            );
        }

        validateEvent(eventType, data);

        // Claim the event in the same transaction as notification creation.
        int inserted = jdbcTemplate.update("""
            INSERT INTO processed_event (event_id, event_type)
            VALUES (?, ?)
            ON CONFLICT (event_id) DO NOTHING
            """, eventId, eventType);

        if (inserted == 0) {
            log.info(
                "[Consumer:DuplicateIgnored] eventId={}, eventType={}",
                eventId, eventType
            );
            return;
        }

        handleEvent(eventId, eventType, data);

        log.info(
            "[Consumer:Committed] eventId={}, eventType={}",
            eventId, eventType
        );
    }

    private void validateEvent(
            String eventType,
            JsonNode data) {

        switch (eventType) {
            case "booking.created.v1",
                 "booking.cancelled.v1" -> {
                requiredText(data, "bookingId");
                requiredText(data, "customerId");
            }

            case "payment.succeeded.v1" -> {
                requiredText(data, "bookingId");
                requiredText(data, "paymentId");
                requiredText(data, "customerId");
            }

            case "session.started.v1" -> {
                requiredText(data, "sessionId");
                requiredText(data, "customerId");
            }

            case "session.completed.v1" -> {
                requiredText(data, "sessionId");
                requiredText(data, "bookingId");
                requiredText(data, "customerId");
            }

            default -> throw new IllegalArgumentException(
                "Unsupported event type: " + eventType
            );
        }
    }

    private void handleEvent(
            String eventId,
            String eventType,
            JsonNode data) throws Exception {

        switch (eventType) {
            case "booking.created.v1" ->
                createNotification(
                    eventId,
                    data,
                    "BOOKING_CREATED",
                    "Booking created",
                    "Your SanitiGo booking has been created."
                );

            case "payment.succeeded.v1" ->
                createNotification(
                    eventId,
                    data,
                    "PAYMENT_SUCCEEDED",
                    "Payment successful",
                    "Your payment for the SanitiGo booking was successful."
                );

            case "booking.cancelled.v1" ->
                createNotification(
                    eventId,
                    data,
                    "BOOKING_CANCELLED",
                    "Booking cancelled",
                    "Your SanitiGo booking has been cancelled."
                );

            case "session.completed.v1" ->
                createNotification(
                    eventId,
                    data,
                    "SESSION_COMPLETED",
                    "Session completed",
                    "Your SanitiGo usage session has been completed."
                );

            case "session.started.v1" ->
                log.info(
                    "[Consumer:SessionStarted] sessionId={}",
                    data.path("sessionId").asText()
                );

            default -> throw new IllegalArgumentException(
                "Unsupported event type: " + eventType
            );
        }

        // Send email notification. Failures are isolated and will not break event processing.
        emailNotificationService.sendNotificationEmail(eventId, eventType, data);
    }

    private void createNotification(
            String eventId,
            JsonNode data,
            String type,
            String title,
            String message) throws Exception {

        notificationWriter.writeNotification(eventId, data, type, title, message);
    }

    private String requiredText(
            JsonNode node,
            String field) {

        JsonNode value = node.get(field);

        if (value == null ||
                !value.isTextual() ||
                value.asText().isBlank()) {
            throw new IllegalArgumentException(
                "Missing or invalid field: " + field
            );
        }

        return value.asText();
    }

    private void requiredVersion(
            JsonNode node,
            String field) {

        JsonNode value = node.get(field);

        if (value == null ||
                value.isNull() ||
                (!value.isNumber() && (!value.isTextual() || value.asText().isBlank()))) {
            throw new IllegalArgumentException(
                "Missing or invalid field: " + field
            );
        }
    }
}
