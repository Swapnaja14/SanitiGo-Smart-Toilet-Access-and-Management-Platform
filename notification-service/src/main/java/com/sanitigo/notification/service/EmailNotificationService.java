package com.sanitigo.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class EmailNotificationService {

    private static final Logger log =
            LoggerFactory.getLogger(EmailNotificationService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EmailSender emailSender;

    public EmailNotificationService(
            JdbcTemplate jdbcTemplate,
            EmailSender emailSender) {
        this.jdbcTemplate = jdbcTemplate;
        this.emailSender = emailSender;
    }

    public void sendNotificationEmail(
            String eventId,
            String eventType,
            JsonNode data) {

        try {
            String customerId = data.path("customerId").asText(null);
            if (customerId == null || customerId.isBlank()) {
                log.warn("[EmailNotification:Skip] Missing customerId in eventId={}", eventId);
                return;
            }

            // Fetch recipient email and fullName from User table
            String recipientEmail = data.path("email").asText(null);
            String recipientName = "Customer";

            List<Map<String, Object>> users = jdbcTemplate.queryForList(
                    "SELECT \"email\", \"fullName\" FROM \"User\" WHERE \"id\" = ?", customerId
            );

            if (!users.isEmpty()) {
                Map<String, Object> user = users.get(0);
                if (recipientEmail == null || recipientEmail.isBlank()) {
                    recipientEmail = (String) user.get("email");
                }
                String fullName = (String) user.get("fullName");
                if (fullName != null && !fullName.isBlank()) {
                    recipientName = fullName;
                }
            }

            if (recipientEmail == null || recipientEmail.isBlank()) {
                log.warn("[EmailNotification:Skip] No recipient email found for customerId={}, eventId={}",
                        customerId, eventId);
                return;
            }

            EmailMessage message = buildMessage(eventType, recipientName, data);
            if (message == null) {
                return;
            }

            emailSender.send(recipientEmail, message.subject(), message.body());

            log.info("[EmailNotification:Sent] Email dispatched to={} for eventId={}, eventType={}",
                    recipientEmail, eventId, eventType);

        } catch (Exception ex) {
            // CRITICAL SAFEGUARD: Keep email failures from breaking the event-processing pipeline
            log.error("[EmailNotification:Failed] Failed sending email for eventId={}, eventType={}: {}. Pipeline will not fail.",
                    eventId, eventType, ex.getMessage());
        }
    }

    private EmailMessage buildMessage(
            String eventType,
            String customerName,
            JsonNode data) {

        return switch (eventType) {
            case "booking.created.v1" -> {
                String bookingId = data.path("bookingId").asText("N/A");
                String toiletId = data.path("toiletId").asText("N/A");
                String amount = data.path("amount").asText("N/A");
                String scheduledDate = data.path("scheduledDate").asText("N/A");
                String startTime = data.path("startTime").asText("N/A");
                String endTime = data.path("endTime").asText("N/A");

                String subject = "SanitiGo Booking Confirmed - #" + bookingId;
                String body = String.format("""
                    Hello %s,

                    Your SanitiGo booking has been confirmed!

                    Booking Details:
                    - Booking ID: %s
                    - Toilet ID: %s
                    - Date: %s
                    - Time: %s - %s
                    - Total Amount: ₹%s

                    Thank you for choosing SanitiGo!
                    """, customerName, bookingId, toiletId, scheduledDate, startTime, endTime, amount);

                yield new EmailMessage(subject, body.stripIndent());
            }

            case "payment.succeeded.v1" -> {
                String bookingId = data.path("bookingId").asText("N/A");
                String paymentId = data.path("paymentId").asText("N/A");
                String amount = data.path("amount").asText("N/A");

                String subject = "SanitiGo Payment Receipt - Booking #" + bookingId;
                String body = String.format("""
                    Hello %s,

                    Your payment for SanitiGo booking #%s has been successfully processed.

                    Payment Details:
                    - Payment ID: %s
                    - Amount Paid: ₹%s
                    - Status: SUCCESS

                    Thank you for using SanitiGo!
                    """, customerName, bookingId, paymentId, amount);

                yield new EmailMessage(subject, body.stripIndent());
            }

            case "booking.cancelled.v1" -> {
                String bookingId = data.path("bookingId").asText("N/A");

                String subject = "SanitiGo Booking Cancelled - #" + bookingId;
                String body = String.format("""
                    Hello %s,

                    Your SanitiGo booking #%s has been cancelled.
                    If applicable, any refund will be credited back to your original payment method in accordance with our cancellation policy.

                    Best regards,
                    SanitiGo Support Team
                    """, customerName, bookingId);

                yield new EmailMessage(subject, body.stripIndent());
            }

            case "session.completed.v1" -> {
                String sessionId = data.path("sessionId").asText("N/A");
                String bookingId = data.path("bookingId").asText("N/A");
                String duration = data.path("durationMinutes").asText("N/A");
                String endedAt = data.path("endedAt").asText("N/A");

                String subject = "SanitiGo Usage Session Completed";
                String body = String.format("""
                    Hello %s,

                    Your usage session has completed.

                    Session Summary:
                    - Session ID: %s
                    - Booking ID: %s
                    - Duration: %s minute(s)
                    - Ended At: %s

                    Thank you for trusting SanitiGo Smart Toilet Services!
                    """, customerName, sessionId, bookingId, duration, endedAt);

                yield new EmailMessage(subject, body.stripIndent());
            }

            default -> null;
        };
    }

    public record EmailMessage(String subject, String body) {}
}
