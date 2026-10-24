package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Execution(ExecutionMode.SAME_THREAD)
@Import(EmailNotificationIntegrationTest.TestEmailConfig.class)
class EmailNotificationIntegrationTest {

    @Autowired
    private EventProcessingService eventProcessingService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CapturingEmailSender capturingEmailSender;

    private static final String TEST_CUSTOMER_ID = "test-email-user-uuid";
    private static final String TEST_CUSTOMER_EMAIL = "customer_email_test@sanitigo.com";
    private static final String TEST_CUSTOMER_NAME = "Ananya Sharma";

    @TestConfiguration
    static class TestEmailConfig {
        @Bean
        @Primary
        public CapturingEmailSender capturingEmailSender() {
            return new CapturingEmailSender();
        }
    }

    public static class CapturingEmailSender implements EmailSender {
        public record SentEmail(String to, String subject, String body) {}

        private final List<SentEmail> sentEmails = new ArrayList<>();
        private volatile boolean shouldFail = false;

        public void setShouldFail(boolean shouldFail) {
            this.shouldFail = shouldFail;
        }

        public void clear() {
            sentEmails.clear();
            shouldFail = false;
        }

        public List<SentEmail> getSentEmails() {
            return new ArrayList<>(sentEmails);
        }

        @Override
        public void send(String to, String subject, String body) throws Exception {
            if (shouldFail) {
                throw new RuntimeException("Simulated SMTP Transport Failure: ConnectException");
            }
            sentEmails.add(new SentEmail(to, subject, body));
        }
    }

    @BeforeEach
    void setUp() {
        capturingEmailSender.clear();

        // Ensure user fixture with email and name exists in test database
        jdbcTemplate.update("""
            INSERT INTO "User" ("id", "email", "password", "fullName", "updatedAt")
            VALUES (?, ?, 'password123', ?, NOW())
            ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "fullName" = EXCLUDED."fullName"
            """, TEST_CUSTOMER_ID, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_NAME);
    }

    @Test
    void bookingCreated_sendsBookingConfirmationEmail() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String bookingId = "bk-" + UUID.randomUUID();

        byte[] message = createEvent(eventId, "booking.created.v1", Map.of(
            "bookingId", bookingId,
            "customerId", TEST_CUSTOMER_ID,
            "toiletId", "toilet-south-mumbai-01",
            "scheduledDate", "2026-11-05",
            "startTime", "10:00",
            "endTime", "10:30",
            "amount", "30.00",
            "status", "CONFIRMED"
        ));

        eventProcessingService.process(message);

        List<CapturingEmailSender.SentEmail> sent = capturingEmailSender.getSentEmails();
        assertEquals(1, sent.size(), "Exactly one email should be sent for booking confirmation");

        CapturingEmailSender.SentEmail email = sent.get(0);
        assertEquals(TEST_CUSTOMER_EMAIL, email.to());
        assertTrue(email.subject().contains("SanitiGo Booking Confirmed"));
        assertTrue(email.subject().contains(bookingId));
        assertTrue(email.body().contains(TEST_CUSTOMER_NAME));
        assertTrue(email.body().contains(bookingId));
        assertTrue(email.body().contains("30.00"));
    }

    @Test
    void paymentSucceeded_sendsPaymentReceiptEmail() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String bookingId = "bk-" + UUID.randomUUID();
        String paymentId = "pay-" + UUID.randomUUID();

        byte[] message = createEvent(eventId, "payment.succeeded.v1", Map.of(
            "bookingId", bookingId,
            "paymentId", paymentId,
            "customerId", TEST_CUSTOMER_ID,
            "toiletId", "toilet-south-mumbai-01",
            "amount", "30.00",
            "paymentStatus", "SUCCESS"
        ));

        eventProcessingService.process(message);

        List<CapturingEmailSender.SentEmail> sent = capturingEmailSender.getSentEmails();
        assertEquals(1, sent.size(), "Exactly one email should be sent for payment receipt");

        CapturingEmailSender.SentEmail email = sent.get(0);
        assertEquals(TEST_CUSTOMER_EMAIL, email.to());
        assertTrue(email.subject().contains("SanitiGo Payment Receipt"));
        assertTrue(email.subject().contains(bookingId));
        assertTrue(email.body().contains(paymentId));
        assertTrue(email.body().contains("30.00"));
        assertTrue(email.body().contains("SUCCESS"));
    }

    @Test
    void bookingCancelled_sendsCancellationEmail() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String bookingId = "bk-" + UUID.randomUUID();

        byte[] message = createEvent(eventId, "booking.cancelled.v1", Map.of(
            "bookingId", bookingId,
            "customerId", TEST_CUSTOMER_ID,
            "toiletId", "toilet-south-mumbai-01",
            "status", "CANCELLED"
        ));

        eventProcessingService.process(message);

        List<CapturingEmailSender.SentEmail> sent = capturingEmailSender.getSentEmails();
        assertEquals(1, sent.size(), "Exactly one email should be sent for booking cancellation");

        CapturingEmailSender.SentEmail email = sent.get(0);
        assertEquals(TEST_CUSTOMER_EMAIL, email.to());
        assertTrue(email.subject().contains("SanitiGo Booking Cancelled"));
        assertTrue(email.subject().contains(bookingId));
        assertTrue(email.body().contains(TEST_CUSTOMER_NAME));
    }

    @Test
    void sessionCompleted_sendsSessionCompletedEmail() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String sessionId = "sess-" + UUID.randomUUID();
        String bookingId = "bk-" + UUID.randomUUID();

        byte[] message = createEvent(eventId, "session.completed.v1", Map.of(
            "sessionId", sessionId,
            "bookingId", bookingId,
            "customerId", TEST_CUSTOMER_ID,
            "toiletId", "toilet-south-mumbai-01",
            "startedAt", "2026-10-24T06:00:00Z",
            "endedAt", "2026-10-24T06:12:00Z",
            "durationMinutes", "12",
            "sessionStatus", "COMPLETED",
            "bookingStatus", "COMPLETED"
        ));

        eventProcessingService.process(message);

        List<CapturingEmailSender.SentEmail> sent = capturingEmailSender.getSentEmails();
        assertEquals(1, sent.size(), "Exactly one email should be sent for completed session");

        CapturingEmailSender.SentEmail email = sent.get(0);
        assertEquals(TEST_CUSTOMER_EMAIL, email.to());
        assertTrue(email.subject().contains("SanitiGo Usage Session Completed"));
        assertTrue(email.body().contains(sessionId));
        assertTrue(email.body().contains("12"));
    }

    @Test
    void emailFailure_doesNotBreakEventProcessingPipeline() throws Exception {
        String eventId = UUID.randomUUID().toString();
        String bookingId = "bk-fail-safe-" + UUID.randomUUID();

        byte[] message = createEvent(eventId, "booking.created.v1", Map.of(
            "bookingId", bookingId,
            "customerId", TEST_CUSTOMER_ID,
            "toiletId", "toilet-south-mumbai-01",
            "amount", "25.00",
            "status", "PENDING"
        ));

        // Simulate SMTP failure (network timeout, mail server down)
        capturingEmailSender.setShouldFail(true);

        // MUST NOT throw exception
        assertDoesNotThrow(() -> eventProcessingService.process(message));

        // In-app Notification and processed_event claim MUST still be committed
        Integer notifCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM \"Notification\" WHERE \"eventId\" = ?", Integer.class, eventId
        );
        assertEquals(1, notifCount, "Notification row must still be committed even if email fails");

        Integer claimCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM processed_event WHERE event_id = ?", Integer.class, eventId
        );
        assertEquals(1, claimCount, "processed_event claim must still be committed even if email fails");
    }

    private byte[] createEvent(String eventId, String eventType, Map<String, Object> data) throws Exception {
        return objectMapper.writeValueAsBytes(Map.of(
            "eventId", eventId,
            "eventType", eventType,
            "version", 1,
            "occurredAt", "2026-10-24T07:00:00.000Z",
            "aggregateId", "aggregate-" + UUID.randomUUID(),
            "data", data
        ));
    }
}
