package com.sanitigo.notification.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(value = EmailSender.class, ignored = DefaultEmailSender.class)
public class DefaultEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(DefaultEmailSender.class);

    @Override
    public void send(String to, String subject, String body) throws Exception {
        log.info("[EmailSender:Delivered] To='{}' | Subject='{}'\nBody:\n{}", to, subject, body);
    }
}
