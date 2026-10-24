package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Import(EventProcessingServiceIntegrationTest.TestConfig.class)
public class EventProcessingServiceIntegrationTest {

    static {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
    }

    private static final String TEST_CUSTOMER_ID = "test-customer-notif-uuid";

    @Autowired
    private EventProcessingService eventProcessingService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FailingRollbackProcessor failingRollbackProcessor;

    @TestConfiguration
    static class TestConfig {
        @Bean
        public FailingRollbackProcessor failingRollbackProcessor(JdbcTemplate jdbcTemplate) {
            return new FailingRollbackProcessor(jdbcTemplate);
        }
    }

    public static class FailingRollbackProcessor {
        private final JdbcTemplate jdbcTemplate;

        public FailingRollbackProcessor(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
        }

        @Transactional
        public void claimAndThrow(String eventId, String eventType, String userId) {
            jdbcTemplate.update("""
                INSERT INTO processed_event (event_id, event_type)
                VALUES (?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """, eventId, eventType);

            jdbcTemplate.update("""
                INSERT INTO "Notification"
                    ("id", "userId", "eventId", "type",
                     "title", "message", "data", "createdAt")
                VALUES (?, ?, ?, 'BOOKING_CREATED'::"NotificationType",
                        'Rollback Title', 'Rollback Message', '{}'::jsonb, NOW())
                ON CONFLICT ("userId", "eventId") DO NOTHING
                """,
                UUID.randomUUID().toString(),
                userId,
                eventId
            );

            throw new RuntimeException("Simulated processing failure after claim and notification insertion");
        }
    }

    @BeforeEach
    void setUp() {
        // Ensure the foreign key reference user exists in the User table
        jdbcTemplate.update("""
            INSERT INTO "User" ("id", "email", "password", "fullName", "updatedAt")
            VALUES (?, 'test-notif-user@sanitigo.com', 'password123', 'Test Notif User', NOW())
            ON CONFLICT ("id") DO NOTHING
            """, TEST_CUSTOMER_ID);
    }

    private byte[] createEventJson(String eventId, String eventType, Map<String, Object> data) throws Exception {
        Map<String, Object> payload = Map.of(
                "eventId", eventId,
                "eventType", eventType,
                "occurredAt", "2026-10-22T08:00:00Z",
                "version", 1,
                "data", data
        );
        return objectMapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void validEvent_createsProcessedEventAndNotification() throws Exception {
        String eventId = "test-valid-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of(
                "bookingId", "b-123",
                "customerId", TEST_CUSTOMER_ID
        ));

        eventProcessingService.process(message);

        Integer processedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, processedCount);

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ? AND \"userId\" = ?",
                Integer.class,
                eventId,
                TEST_CUSTOMER_ID
        );
        assertEquals(1, notifCount, "Notification row must be created in the same transaction.");
    }

    @Test
    void duplicateEvent_doesNotCreateDuplicateRecord() throws Exception {
        String eventId = "test-dup-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of(
                "bookingId", "b-456",
                "customerId", TEST_CUSTOMER_ID
        ));

        eventProcessingService.process(message);
        eventProcessingService.process(message); // Second attempt

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, count);

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, notifCount, "Duplicate event delivery must not create duplicate notifications.");
    }

    @Test
    void unsupportedEventType_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-unsupported-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "unknown.event.v1", Map.of(
                "bookingId", "b-789",
                "customerId", TEST_CUSTOMER_ID
        ));

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, notifCount);
    }

    @Test
    void missingRequiredIdentifier_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-missing-id-" + UUID.randomUUID();
        // booking.created.v1 missing bookingId and customerId
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of());

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, notifCount);
    }

    @Test
    void processingFailureAfterClaim_rollsBackTransaction() {
        String eventId = "test-rollback-" + UUID.randomUUID();

        assertThrows(RuntimeException.class, () ->
                failingRollbackProcessor.claimAndThrow(eventId, "booking.created.v1", TEST_CUSTOMER_ID)
        );

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count, "processed_event claim must roll back; no committed record should exist.");

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, notifCount, "Notification insertion must roll back; no committed record should exist.");
    }

    @Test
    void concurrentDeliveries_claimAtMostOnce() throws Exception {
        String eventId = "test-concurrent-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "payment.succeeded.v1", Map.of(
                "bookingId", "b-concurrent",
                "paymentId", "pay-concurrent",
                "customerId", TEST_CUSTOMER_ID
        ));

        int threadCount = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    latch.await();
                    eventProcessingService.process(message);
                } catch (Exception e) {
                    // Ignored in concurrent runner
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        latch.countDown(); // Start all threads simultaneously
        assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, count, "Concurrent deliveries must result in at most one committed record.");

        Integer notifCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, notifCount, "Concurrent deliveries must result in at most one notification.");
    }

    @Test
    void missingEnvelopeFields_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-missing-envelope-" + UUID.randomUUID();
        // Missing occurredAt and version
        Map<String, Object> payloadWithoutEnvelope = Map.of(
                "eventId", eventId,
                "eventType", "booking.created.v1",
                "data", Map.of("bookingId", "b-env", "customerId", TEST_CUSTOMER_ID)
        );
        byte[] message = objectMapper.writeValueAsString(payloadWithoutEnvelope).getBytes(StandardCharsets.UTF_8);

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);
    }

    @Test
    void paymentSucceededMissingPaymentId_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-missing-payid-" + UUID.randomUUID();
        // payment.succeeded.v1 missing paymentId
        byte[] message = createEventJson(eventId, "payment.succeeded.v1", Map.of(
                "bookingId", "b-pay",
                "customerId", TEST_CUSTOMER_ID
        ));

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);
    }
}
