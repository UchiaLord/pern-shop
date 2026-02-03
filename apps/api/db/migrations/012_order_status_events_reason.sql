ALTER TABLE order_status_events
  ADD COLUMN reason text;

-- optional: Länge limitieren via CHECK
ALTER TABLE order_status_events
  ADD CONSTRAINT order_status_events_reason_len_chk
  CHECK (reason IS NULL OR length(reason) <= 500);