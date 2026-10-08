CREATE TABLE orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL CHECK (provider IN ('uber_eats', 'doordash')),
  external_order_id text NOT NULL,
  status            text NOT NULL
                    CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  -- The provider's own status string, kept for debugging the mapping.
  provider_status   text,
  customer          jsonb NOT NULL,
  line_items        jsonb NOT NULL,
  subtotal_cents    integer,
  tax_cents         integer,
  total_cents       integer NOT NULL,
  currency          char(3) NOT NULL,
  placed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  raw_payload       jsonb NOT NULL,
  -- The idempotency key: retries and duplicate deliveries collapse onto one row.
  CONSTRAINT orders_provider_external_id_key UNIQUE (provider, external_order_id)
);

CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);
