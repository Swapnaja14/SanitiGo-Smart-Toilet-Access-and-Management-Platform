package com.sanitigo.notification.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.RetryInterceptorBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.retry.RejectAndDontRequeueRecoverer;
import org.springframework.boot.autoconfigure.amqp.SimpleRabbitListenerContainerFactoryConfigurer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.interceptor.RetryOperationsInterceptor;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class RabbitMQConfig {

    @Value("${sanitigo.rabbitmq.exchange}")
    private String exchangeName;

    @Value("${sanitigo.rabbitmq.queue}")
    private String queueName;

    @Value("${sanitigo.rabbitmq.dead-letter-exchange}")
    private String dlxName;

    @Value("${sanitigo.rabbitmq.dead-letter-queue}")
    private String dlqName;

    @Value("${sanitigo.rabbitmq.dead-letter-routing-key}")
    private String dlqRoutingKey;

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    public TopicExchange sanitigoExchange() {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(dlxName, true, false);
    }

    @Bean
    public Queue bookingEventsQueue() {
        return QueueBuilder.durable(queueName)
                .deadLetterExchange(dlxName)
                .deadLetterRoutingKey(dlqRoutingKey)
                .build();
    }

    @Bean
    public Queue bookingEventsDeadLetterQueue() {
        return QueueBuilder.durable(dlqName).build();
    }

    @Bean
    public Binding bookingEventsBinding() {
        return BindingBuilder.bind(bookingEventsQueue())
                .to(sanitigoExchange())
                .with("#");
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(bookingEventsDeadLetterQueue())
                .to(deadLetterExchange())
                .with(dlqRoutingKey);
    }

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(RabbitMQConfig.class);

    @Bean
    public RetryOperationsInterceptor rabbitRetryInterceptor() {
        return RetryInterceptorBuilder.stateless()
                .maxAttempts(4)
                .backOffOptions(1000, 2.0, 10000)
                .recoverer(new RejectAndDontRequeueRecoverer() {
                    @Override
                    public void recover(org.springframework.amqp.core.Message message, Throwable cause) {
                        String messageId = message.getMessageProperties().getMessageId();
                        String eventType = message.getMessageProperties().getType();
                        log.error("[Consumer:DeadLettered] Maximum retries exhausted (4 attempts). Message forwarded to DLQ: messageId={}, eventType={}, cause={}",
                                messageId, eventType, cause != null ? cause.getMessage() : "Unknown");
                        super.recover(message, cause);
                    }
                })
                .build();
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            SimpleRabbitListenerContainerFactoryConfigurer configurer,
            ConnectionFactory connectionFactory,
            RetryOperationsInterceptor rabbitRetryInterceptor) {

        SimpleRabbitListenerContainerFactory factory =
                new SimpleRabbitListenerContainerFactory();

        configurer.configure(factory, connectionFactory);
        factory.setAcknowledgeMode(
                org.springframework.amqp.core.AcknowledgeMode.AUTO);
        factory.setDefaultRequeueRejected(false);
        factory.setPrefetchCount(10);
        factory.setAdviceChain(rabbitRetryInterceptor);

        return factory;
    }
}
