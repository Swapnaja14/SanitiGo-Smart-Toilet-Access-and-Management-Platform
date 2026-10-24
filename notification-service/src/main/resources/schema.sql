CREATE TABLE IF NOT EXISTS processed_event (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(150) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
