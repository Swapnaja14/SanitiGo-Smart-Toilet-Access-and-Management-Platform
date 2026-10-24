package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
class NotificationWriter {

    private static final Logger log =
            LoggerFactory.getLogger(NotificationWriter.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private volatile boolean failAfterInsert = false;

    NotificationWriter(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    void setFailAfterInsert(boolean failAfterInsert) {
        this.failAfterInsert = failAfterInsert;
    }

    public void writeNotification(
            String eventId,
            JsonNode data,
            String type,
            String title,
            String message) throws Exception {

        JsonNode customerIdNode = data.get("customerId");
        if (customerIdNode == null || !customerIdNode.isTextual() || customerIdNode.asText().isBlank()) {
            throw new IllegalArgumentException("Missing or invalid field: customerId");
        }
        String userId = customerIdNode.asText();

        String metadata = objectMapper.writeValueAsString(data);

        int inserted = jdbcTemplate.update("""
            INSERT INTO "Notification"
                ("id", "userId", "eventId", "type",
                 "title", "message", "data", "createdAt")
            VALUES (?, ?, ?, ?::"NotificationType",
                    ?, ?, ?::jsonb, NOW())
            ON CONFLICT ("userId", "eventId") DO NOTHING
            """,
            UUID.randomUUID().toString(),
            userId,
            eventId,
            type,
            title,
            message,
            metadata
        );

        if (inserted == 1) {
            log.info(
                "[Notification:Created] eventId={}, userId={}, type={}",
                eventId, userId, type
            );
        } else {
            log.warn(
                "[Notification:DuplicateIgnored] eventId={}, userId={}",
                eventId, userId
            );
        }

        if (failAfterInsert) {
            throw new RuntimeException("Deliberate test failure after notification insertion for rollback verification");
        }
    }
}
