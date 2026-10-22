package com.sanitigo.notification.consumer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class BookingEventConsumer {

    private static final Logger log =
            LoggerFactory.getLogger(BookingEventConsumer.class);

    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    public BookingEventConsumer(
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate) {
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
    }

    @RabbitListener(queues = "${sanitigo.rabbitmq.queue}")
    public void consume(byte[] message) throws Exception {
        JsonNode event = objectMapper.readTree(message);

        String eventId = event.path("eventId").asText(null);
        String eventType = event.path("eventType").asText(null);

        if (eventId == null || eventType == null) {
            throw new IllegalArgumentException(
                    "Event must contain eventId and eventType");
        }

        int inserted = jdbcTemplate.update(
                """
                INSERT INTO processed_event (event_id, event_type)
                VALUES (?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """,
                eventId,
                eventType
        );

        if (inserted == 0) {
            log.info("Duplicate event ignored: {}", eventId);
            return;
        }

        JsonNode data = event.path("data");

        switch (eventType) {
            case "booking.created.v1" ->
                    log.info("Booking created: {}",
                            data.path("bookingId").asText());

            case "payment.succeeded.v1" ->
                    log.info("Payment succeeded for booking: {}",
                            data.path("bookingId").asText());

            case "booking.cancelled.v1" ->
                    log.info("Booking cancelled: {}",
                            data.path("bookingId").asText());

            case "session.started.v1" ->
                    log.info("Session started: {}",
                            data.path("sessionId").asText());

            case "session.completed.v1" ->
                    log.info("Session completed: {}",
                            data.path("sessionId").asText());

            default ->
                    log.warn("Unknown event type: {}", eventType);
        }
    }
}
