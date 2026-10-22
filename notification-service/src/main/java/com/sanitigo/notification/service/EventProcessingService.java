package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventProcessingService {

    private static final Logger log = LoggerFactory.getLogger(EventProcessingService.class);

    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    public EventProcessingService(
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate) {
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void process(byte[] message) throws Exception {
        JsonNode event = objectMapper.readTree(message);

        String eventId = requiredText(event, "eventId");
        String eventType = requiredText(event, "eventType");

        log.info("[Consumer:Processing] Starting event processing eventId={}, eventType={}",
                eventId, eventType);

        JsonNode data = event.get("data");
        if (data == null || !data.isObject()) {
            throw new IllegalArgumentException(
                "Event must contain a data object");
        }

        // Validate the complete supported event before claiming it.
        validateEvent(eventType, data);

        // Atomic claim: the primary key prevents concurrent duplicates.
        int inserted = jdbcTemplate.update("""
            INSERT INTO processed_event (event_id, event_type)
            VALUES (?, ?)
            ON CONFLICT (event_id) DO NOTHING
            """, eventId, eventType);

        if (inserted == 0) {
            // Already committed by a previous successful attempt.
            log.warn("[Consumer:DuplicateIgnored] Event already committed; ignoring duplicate eventId={}, eventType={}",
                    eventId, eventType);
            return;
        }

        // All database-side event effects must run here, in this
        // same transaction, before the method returns successfully.
        handleEvent(eventType, data);

        log.info("[Consumer:Committed] Successfully committed eventId={}, eventType={}",
                eventId, eventType);
    }

    private void validateEvent(
            String eventType,
            JsonNode data) {

        switch (eventType) {
            case "booking.created.v1",
                 "payment.succeeded.v1",
                 "booking.cancelled.v1" ->
                requiredText(data, "bookingId");

            case "session.started.v1",
                 "session.completed.v1" ->
                requiredText(data, "sessionId");

            default -> throw new IllegalArgumentException(
                "Unsupported event type: " + eventType);
        }
    }

    private void handleEvent(
            String eventType,
            JsonNode data) {

        // The current MVP only logs events.
        // Add transactional database effects here when required.
        switch (eventType) {
            case "booking.created.v1" ->
                System.out.println(
                    "Booking created: " +
                    data.path("bookingId").asText());

            case "payment.succeeded.v1" ->
                System.out.println(
                    "Payment succeeded: " +
                    data.path("bookingId").asText());

            case "booking.cancelled.v1" ->
                System.out.println(
                    "Booking cancelled: " +
                    data.path("bookingId").asText());

            case "session.started.v1" ->
                System.out.println(
                    "Session started: " +
                    data.path("sessionId").asText());

            case "session.completed.v1" ->
                System.out.println(
                    "Session completed: " +
                    data.path("sessionId").asText());

            default -> throw new IllegalArgumentException(
                "Unsupported event type: " + eventType);
        }
    }

    private String requiredText(
            JsonNode node,
            String field) {

        JsonNode value = node.get(field);

        if (value == null ||
                !value.isTextual() ||
                value.asText().isBlank()) {
            throw new IllegalArgumentException(
                "Missing or invalid field: " + field);
        }

        return value.asText();
    }
}
