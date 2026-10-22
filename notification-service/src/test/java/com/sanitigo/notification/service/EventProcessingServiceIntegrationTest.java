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

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Import(EventProcessingServiceIntegrationTest.TestConfig.class)
public class EventProcessingServiceIntegrationTest {

    static {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
    }

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
        public void claimAndThrow(String eventId, String eventType) {
            jdbcTemplate.update("""
                INSERT INTO processed_event (event_id, event_type)
                VALUES (?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """, eventId, eventType);

            throw new RuntimeException("Simulated processing failure after claim");
        }
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
    void validEvent_createsProcessedEventRecord() throws Exception {
        String eventId = "test-valid-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of("bookingId", "b-123"));

        eventProcessingService.process(message);

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, count);
    }

    @Test
    void duplicateEvent_doesNotCreateDuplicateRecord() throws Exception {
        String eventId = "test-dup-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of("bookingId", "b-456"));

        eventProcessingService.process(message);
        eventProcessingService.process(message); // Second attempt

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(1, count);
    }

    @Test
    void unsupportedEventType_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-unsupported-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "unknown.event.v1", Map.of("bookingId", "b-789"));

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);
    }

    @Test
    void missingRequiredIdentifier_failsAndLeavesNoCommittedRecord() throws Exception {
        String eventId = "test-missing-id-" + UUID.randomUUID();
        // booking.created.v1 missing bookingId
        byte[] message = createEventJson(eventId, "booking.created.v1", Map.of());

        assertThrows(IllegalArgumentException.class, () -> eventProcessingService.process(message));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count);
    }

    @Test
    void processingFailureAfterClaim_rollsBackTransaction() {
        String eventId = "test-rollback-" + UUID.randomUUID();

        assertThrows(RuntimeException.class, () ->
                failingRollbackProcessor.claimAndThrow(eventId, "booking.created.v1")
        );

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId
        );
        assertEquals(0, count, "Transaction must roll back; no committed record should exist.");
    }

    @Test
    void concurrentDeliveries_claimAtMostOnce() throws Exception {
        String eventId = "test-concurrent-" + UUID.randomUUID();
        byte[] message = createEventJson(eventId, "payment.succeeded.v1", Map.of("bookingId", "b-concurrent"));

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
    }
}
