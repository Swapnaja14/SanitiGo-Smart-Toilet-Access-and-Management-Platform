package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Execution(ExecutionMode.SAME_THREAD)
class NotificationProcessingIntegrationTest {

    @Autowired
    private EventProcessingService eventProcessingService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NotificationWriter notificationWriter;

    // Customer fixture created by test setup.
    private String customerId;

    @BeforeEach
    void setUp() {
        customerId = "test-customer-notif-uuid";

        // Ensure customer fixture exists in test database
        jdbcTemplate.update("""
            INSERT INTO "User" ("id", "email", "password", "fullName", "updatedAt")
            VALUES (?, 'test-notif-user@sanitigo.com', 'password123', 'Test Notif User', NOW())
            ON CONFLICT ("id") DO NOTHING
            """, customerId);

        assertNotNull(
            customerId,
            "Configure test customerId with an existing test user ID"
        );
    }

    @Test
    void bookingCreatedCreatesOneNotification() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String bookingId = "test-booking-" + UUID.randomUUID();

        process(event(eventId, "booking.created.v1", Map.of(
            "bookingId", bookingId,
            "customerId", customerId,
            "toiletId", "test-toilet",
            "amount", "25",
            "status", "PENDING"
        )));

        assertEquals(1, notificationCount(eventId));
        assertEquals(1, processedEventCount(eventId));
        assertEquals(
            "BOOKING_CREATED",
            notificationType(eventId)
        );
        assertEquals(
            customerId,
            notificationUserId(eventId)
        );
    }

    @Test
    void paymentSucceededCreatesPaymentNotification()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        process(event(eventId, "payment.succeeded.v1", Map.of(
            "bookingId", "booking-" + UUID.randomUUID(),
            "paymentId", "payment-" + UUID.randomUUID(),
            "customerId", customerId,
            "toiletId", "test-toilet",
            "amount", "25",
            "paymentStatus", "SUCCESS"
        )));

        assertEquals(1, notificationCount(eventId));
        assertEquals(
            "PAYMENT_SUCCEEDED",
            notificationType(eventId)
        );
    }

    @Test
    void bookingCancelledCreatesCancellationNotification()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        process(event(eventId, "booking.cancelled.v1", Map.of(
            "bookingId", "booking-" + UUID.randomUUID(),
            "customerId", customerId,
            "toiletId", "test-toilet",
            "status", "CANCELLED"
        )));

        assertEquals(1, notificationCount(eventId));
        assertEquals(
            "BOOKING_CANCELLED",
            notificationType(eventId)
        );
    }

    @Test
    void sessionCompletedCreatesCompletionNotification()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        process(event(eventId, "session.completed.v1", Map.of(
            "sessionId", "session-" + UUID.randomUUID(),
            "bookingId", "booking-" + UUID.randomUUID(),
            "customerId", customerId,
            "toiletId", "test-toilet",
            "startedAt", "2026-10-22T05:40:02.382Z",
            "endedAt", "2026-10-22T05:40:05.827Z",
            "durationMinutes", 1,
            "sessionStatus", "COMPLETED",
            "bookingStatus", "COMPLETED"
        )));

        assertEquals(1, notificationCount(eventId));
        assertEquals(
            "SESSION_COMPLETED",
            notificationType(eventId)
        );
    }

    @Test
    void duplicateDeliveryDoesNotCreateAnotherNotification()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        byte[] message = event(
            eventId,
            "booking.created.v1",
            Map.of(
                "bookingId", "booking-" + UUID.randomUUID(),
                "customerId", customerId,
                "toiletId", "test-toilet",
                "amount", "25",
                "status", "PENDING"
            )
        );

        process(message);
        process(message);

        assertEquals(1, notificationCount(eventId));
        assertEquals(1, processedEventCount(eventId));
    }

    @Test
    void invalidEventDoesNotCreateNotificationOrClaim()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        byte[] message = event(
            eventId,
            "booking.created.v1",
            Map.of(
                "bookingId", "booking-" + UUID.randomUUID()
                // customerId deliberately omitted
            )
        );

        assertThrows(
            IllegalArgumentException.class,
            () -> process(message)
        );

        assertEquals(0, notificationCount(eventId));
        assertEquals(0, processedEventCount(eventId));
    }

    @Test
    void concurrentDuplicateDeliveriesCreateOneNotification()
            throws Exception {
        String eventId = UUID.randomUUID().toString();

        byte[] message = event(
            eventId,
            "booking.created.v1",
            Map.of(
                "bookingId", "booking-" + UUID.randomUUID(),
                "customerId", customerId,
                "toiletId", "test-toilet",
                "amount", "25",
                "status", "PENDING"
            )
        );

        var executor = Executors.newFixedThreadPool(4);

        try {
            List<Callable<Void>> tasks = List.of(
                () -> { process(message); return null; },
                () -> { process(message); return null; },
                () -> { process(message); return null; },
                () -> { process(message); return null; }
            );

            for (var future : executor.invokeAll(tasks)) {
                future.get();
            }
        } finally {
            executor.shutdownNow();
        }

        assertEquals(1, notificationCount(eventId));
        assertEquals(1, processedEventCount(eventId));
    }

    @Test
    void failureAfterNotificationInsertion_rollsBackBothClaimAndNotification() throws Exception {
        String eventId = UUID.randomUUID().toString();

        byte[] message = event(
            eventId,
            "booking.created.v1",
            Map.of(
                "bookingId", "booking-" + UUID.randomUUID(),
                "customerId", customerId,
                "toiletId", "test-toilet",
                "amount", "25",
                "status", "PENDING"
            )
        );

        notificationWriter.setFailAfterInsert(true);
        try {
            assertThrows(RuntimeException.class, () -> process(message));
        } finally {
            notificationWriter.setFailAfterInsert(false);
        }

        assertEquals(0, notificationCount(eventId), "Notification must be rolled back on failure");
        assertEquals(0, processedEventCount(eventId), "processed_event claim must be rolled back on failure");
    }

    @Test
    void failedProcessingCanBeRetriedWithoutLosingNotificationOrCreatingDuplicates() throws Exception {
        String eventId = UUID.randomUUID().toString();

        byte[] message = event(
            eventId,
            "booking.created.v1",
            Map.of(
                "bookingId", "booking-retry-" + UUID.randomUUID(),
                "customerId", customerId,
                "toiletId", "test-toilet",
                "amount", "25",
                "status", "PENDING"
            )
        );

        // 1. Initial attempt fails during processing
        notificationWriter.setFailAfterInsert(true);
        try {
            assertThrows(RuntimeException.class, () -> process(message));
        } finally {
            notificationWriter.setFailAfterInsert(false);
        }

        // Verify transaction rolled back cleanly: nothing committed
        assertEquals(0, notificationCount(eventId));
        assertEquals(0, processedEventCount(eventId));

        // 2. Retry succeeds without issue
        process(message);

        assertEquals(1, notificationCount(eventId));
        assertEquals(1, processedEventCount(eventId));
        assertEquals("BOOKING_CREATED", notificationType(eventId));

        // 3. Any subsequent redelivery is handled as duplicate without extra records
        process(message);

        assertEquals(1, notificationCount(eventId));
        assertEquals(1, processedEventCount(eventId));
    }

    private void process(byte[] message) throws Exception {
        eventProcessingService.process(message);
    }

    private byte[] event(
            String eventId,
            String eventType,
            Map<String, Object> data) throws Exception {

        return objectMapper.writeValueAsBytes(Map.of(
            "eventId", eventId,
            "eventType", eventType,
            "version", 1,
            "occurredAt", "2026-10-22T05:01:45.896Z",
            "aggregateId", "test-aggregate",
            "data", data
        ));
    }

    private int notificationCount(String eventId) {
        return jdbcTemplate.queryForObject("""
            SELECT COUNT(*)
            FROM "Notification"
            WHERE "eventId" = ?
            """, Integer.class, eventId);
    }

    private int processedEventCount(String eventId) {
        return jdbcTemplate.queryForObject("""
            SELECT COUNT(*)
            FROM processed_event
            WHERE event_id = ?
            """, Integer.class, eventId);
    }

    private String notificationType(String eventId) {
        return jdbcTemplate.queryForObject("""
            SELECT "type"::text
            FROM "Notification"
            WHERE "eventId" = ?
            """, String.class, eventId);
    }

    private String notificationUserId(String eventId) {
        return jdbcTemplate.queryForObject("""
            SELECT "userId"
            FROM "Notification"
            WHERE "eventId" = ?
            """, String.class, eventId);
    }
}
