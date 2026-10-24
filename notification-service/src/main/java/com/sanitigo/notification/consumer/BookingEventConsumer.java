package com.sanitigo.notification.consumer;

import com.sanitigo.notification.service.EventProcessingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class BookingEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(BookingEventConsumer.class);
    private final EventProcessingService eventProcessingService;

    public BookingEventConsumer(
            EventProcessingService eventProcessingService) {
        this.eventProcessingService = eventProcessingService;
    }

    @RabbitListener(
        queues = "${sanitigo.rabbitmq.queue}",
        containerFactory = "rabbitListenerContainerFactory"
    )
    public void consume(Message message) throws Exception {
        String messageId = message.getMessageProperties().getMessageId();
        String eventType = message.getMessageProperties().getType();
        boolean redelivered = message.getMessageProperties().isRedelivered();

        log.info("[Consumer:Dispatch] Incoming message messageId={}, eventType={}, redelivered={}",
                messageId, eventType, redelivered);

        try {
            eventProcessingService.process(message.getBody());
        } catch (Exception ex) {
            log.error("[Consumer:ProcessingError] Failed processing messageId={}, eventType={}, error={}",
                    messageId, eventType, ex.getMessage());
            throw ex;
        }
    }
}

