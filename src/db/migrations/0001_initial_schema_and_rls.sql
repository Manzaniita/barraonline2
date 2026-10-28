-- ============================================================================
-- BARRAONLINE.COM.AR — MIGRACIÓN INICIAL POSTGRESQL 16 + RLS FORZADO
-- ============================================================================

-- En PostgreSQL 16 gen_random_uuid() es nativo del core sin requerir extensiones externas.

-- Rol de ejecución sin privilegios de superusuario ni BYPASSRLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime_user') THEN
        CREATE ROLE app_runtime_user NOLOGIN NOBYPASSRLS;
    END IF;
END $$;

-- Funciones de contexto transaccional para RLS
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_is_superadmin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_superadmin', true) = 'true', false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 1. NÚCLEO MULTI-TENANT E IDENTIDAD
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED_MORA', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'BARTENDER', 'MARKETING', 'READONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(63) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
    legal_name VARCHAR(200) NOT NULL,
    fantasy_name VARCHAR(120) NOT NULL,
    cuit VARCHAR(13) NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT 'Villa Gesell',
    address VARCHAR(160) NOT NULL DEFAULT '',
    status tenant_status NOT NULL DEFAULT 'ONBOARDING',
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    business_day_cutoff_hour SMALLINT NOT NULL DEFAULT 10 CHECK (business_day_cutoff_hour BETWEEN 0 AND 23),
    alcohol_cutoff_hour SMALLINT NOT NULL DEFAULT 5 CHECK (alcohol_cutoff_hour BETWEEN 0 AND 23),
    reservation_ttl_seconds INTEGER NOT NULL DEFAULT 420 CHECK (reservation_ttl_seconds BETWEEN 60 AND 900),
    allow_bartender_conflict_resolution BOOLEAN NOT NULL DEFAULT true,
    theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(255) UNIQUE,
    email VARCHAR(320) UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tickets de intercambio de un solo uso para autenticación entre subdominios
CREATE TABLE IF NOT EXISTS auth_exchange_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    staff_display_name VARCHAR(120) NOT NULL,
    role user_role NOT NULL,
    shift_pin_hash VARCHAR(128),
    shift_pin_expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_role ON tenant_users (tenant_id, role) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS bar_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    sector VARCHAR(60) NOT NULL DEFAULT 'Barra Principal',
    device_token_hash VARCHAR(64) NOT NULL UNIQUE,
    authorized_by_user_id UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_bar_stations_tenant ON bar_stations (tenant_id) WHERE is_revoked = false;

CREATE TABLE IF NOT EXISTS tenant_mp_credentials (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    mp_user_id BIGINT NOT NULL UNIQUE,
    mp_public_key TEXT NOT NULL,
    access_token_ciphertext BYTEA NOT NULL,
    access_token_iv BYTEA NOT NULL,
    access_token_tag BYTEA NOT NULL,
    refresh_token_ciphertext BYTEA NOT NULL,
    refresh_token_iv BYTEA NOT NULL,
    refresh_token_tag BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    scopes TEXT NOT NULL DEFAULT 'offline_access read write',
    token_expires_at TIMESTAMPTZ NOT NULL,
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_healthcheck_at TIMESTAMPTZ,
    connection_status VARCHAR(32) NOT NULL DEFAULT 'CONNECTED' CHECK (connection_status IN ('CONNECTED', 'TOKEN_EXPIRED', 'REVOKED', 'ERROR')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mp_credentials_mp_user_id ON tenant_mp_credentials (mp_user_id);

-- ============================================================================
-- 2. CATÁLOGO, PRECIOS Y STOCK
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    badge_text VARCHAR(40),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_sort ON categories (tenant_id, sort_order) WHERE is_visible = true;

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(400) NOT NULL DEFAULT '',
    image_url TEXT,
    is_alcoholic BOOLEAN NOT NULL DEFAULT true,
    price_cents BIGINT NOT NULL CHECK (price_cents > 0),
    promo_price_cents BIGINT CHECK (promo_price_cents IS NULL OR (promo_price_cents > 0 AND promo_price_cents < price_cents)),
    promo_label VARCHAR(60),
    stock_total INTEGER NOT NULL DEFAULT 0 CHECK (stock_total >= 0),
    stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
    stock_sold INTEGER NOT NULL DEFAULT 0 CHECK (stock_sold >= 0),
    max_per_order SMALLINT NOT NULL DEFAULT 10 CHECK (max_per_order BETWEEN 1 AND 50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_stock_invariant CHECK (stock_reserved + stock_sold <= stock_total),
    CONSTRAINT fk_products_category FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id) ON DELETE CASCADE,
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_products_tenant_catalog ON products (tenant_id, category_id, sort_order) WHERE is_active = true;

-- ============================================================================
-- 3. PEDIDOS, RESERVAS DE STOCK, PAGOS Y DEVOLUCIONES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'PENDING_CHECKOUT',
        'AWAITING_WEBHOOK',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
        'CHARGED_BACK'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fulfillment_status AS ENUM (
        'AWAITING_PAYMENT',
        'READY_FOR_PICKUP',
        'STOCK_CONFLICT',
        'IN_BAR_PREPARATION',
        'DELIVERED',
        'RESOLVED_WITH_SUBSTITUTE',
        'CANCELLED_UNPAID',
        'CANCELLED_REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_number VARCHAR(32) NOT NULL,
    customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_display_name VARCHAR(120),
    guest_session_hash VARCHAR(64),
    guest_recovery_contact VARCHAR(160),
    order_access_token_hash VARCHAR(64) NOT NULL UNIQUE,
    payment_status payment_status NOT NULL DEFAULT 'PENDING_CHECKOUT',
    fulfillment_status fulfillment_status NOT NULL DEFAULT 'AWAITING_PAYMENT',
    subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents > 0),
    discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
    total_cents BIGINT NOT NULL CHECK (total_cents > 0 AND total_cents = subtotal_cents - discount_cents),
    refunded_cents BIGINT NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0 AND refunded_cents <= total_cents),
    applied_commission_rule_id UUID,
    applied_commission_bps INTEGER NOT NULL CHECK (applied_commission_bps BETWEEN 0 AND 10000),
    idempotency_key VARCHAR(64) NOT NULL,
    business_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, order_number),
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_business_date ON orders (tenant_id, business_date, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders (tenant_id, payment_status, fulfillment_status);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name_snapshot VARCHAR(120) NOT NULL,
    unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents > 0),
    quantity SMALLINT NOT NULL CHECK (quantity > 0),
    line_total_cents BIGINT NOT NULL CHECK (line_total_cents = unit_price_cents * quantity),
    substituted_by_product_id UUID,
    substituted_product_name VARCHAR(120),
    substitution_notes VARCHAR(255),
    CONSTRAINT fk_order_items_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (tenant_id, order_id);

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED_EXPIRED', 'RELEASED_REJECTED', 'LATE_CONFLICT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL UNIQUE,
    status reservation_status NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_reservations_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id) ON DELETE CASCADE,
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_reservations_active_expiry ON stock_reservations (expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_order ON stock_reservations (tenant_id, order_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL,
    mp_preference_id VARCHAR(120),
    mp_init_point TEXT,
    mp_payment_id BIGINT UNIQUE,
    mp_merchant_order_id BIGINT,
    status VARCHAR(40) NOT NULL,
    status_detail VARCHAR(80),
    payment_type_id VARCHAR(40),
    gross_amount_cents BIGINT NOT NULL CHECK (gross_amount_cents > 0),
    mp_fee_cents BIGINT NOT NULL DEFAULT 0,
    net_received_by_tenant_cents BIGINT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    raw_mp_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payments_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_order ON payment_transactions (tenant_id, order_id);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL,
    payment_transaction_id UUID NOT NULL,
    mp_refund_id BIGINT UNIQUE,
    refund_type VARCHAR(32) NOT NULL CHECK (refund_type IN ('FULL', 'PARTIAL', 'STOCK_CONFLICT_REFUND', 'CHARGEBACK')),
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    reason VARCHAR(255) NOT NULL,
    initiated_by_user_id UUID REFERENCES users(id),
    status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_refunds_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
    CONSTRAINT fk_refunds_payment FOREIGN KEY (tenant_id, payment_transaction_id) REFERENCES payment_transactions (tenant_id, id),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_order ON refunds (tenant_id, order_id);

-- ============================================================================
-- 4. QR DE USO ÚNICO Y AUDITORÍA DE CANJE
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE qr_status AS ENUM (
        'ACTIVE',
        'STOCK_CONFLICT',
        'REDEEMED',
        'REVOKED_REFUND',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS order_qrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL UNIQUE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    -- El token opaco firmado solo para mostrar el QR al titular autenticado de la orden
    qr_raw_token VARCHAR(96) NOT NULL UNIQUE,
    short_verification_code VARCHAR(8) NOT NULL,
    status qr_status NOT NULL DEFAULT 'ACTIVE',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at TIMESTAMPTZ,
    redeemed_by_tenant_user_id UUID,
    redeemed_at_station_id UUID,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT fk_qrs_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
    CONSTRAINT fk_qrs_redeemed_user FOREIGN KEY (tenant_id, redeemed_by_tenant_user_id) REFERENCES tenant_users (tenant_id, id),
    CONSTRAINT fk_qrs_station FOREIGN KEY (tenant_id, redeemed_at_station_id) REFERENCES bar_stations (tenant_id, id),
    CONSTRAINT chk_qr_redeemed_fields CHECK (
        (status = 'REDEEMED' AND redeemed_at IS NOT NULL AND redeemed_by_tenant_user_id IS NOT NULL)
        OR (status <> 'REDEEMED')
    ),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_order_qrs_tenant_status ON order_qrs (tenant_id, status);

CREATE TABLE IF NOT EXISTS qr_redemption_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_qr_id UUID,
    attempted_token_prefix VARCHAR(16),
    tenant_user_id UUID,
    station_id UUID,
    attempt_result VARCHAR(40) NOT NULL CHECK (attempt_result IN (
        'SUCCESS_REDEEMED',
        'SUCCESS_SUBSTITUTED',
        'REJECTED_ALREADY_REDEEMED',
        'REJECTED_WRONG_TENANT',
        'REJECTED_INVALID_TOKEN',
        'REJECTED_REVOKED_OR_REFUNDED',
        'STOCK_CONFLICT_PROMPTED'
    )),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qr_logs_tenant_qr ON qr_redemption_logs (tenant_id, order_qr_id, created_at DESC);

-- ============================================================================
-- 5. MODELO COMERCIAL: PLANES, COMISIONES, LIQUIDACIONES Y ABONOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_name VARCHAR(80) NOT NULL,
    monthly_fee_cents BIGINT NOT NULL CHECK (monthly_fee_cents >= 0),
    billing_day_of_month SMALLINT NOT NULL DEFAULT 5 CHECK (billing_day_of_month BETWEEN 1 AND 28),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    created_by_superadmin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_active ON tenant_plans (tenant_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS tenant_commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    commission_bps INTEGER NOT NULL CHECK (commission_bps BETWEEN 0 AND 5000),
    deduct_refunds BOOLEAN NOT NULL DEFAULT true,
    deduct_chargebacks BOOLEAN NOT NULL DEFAULT true,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    notes TEXT,
    created_by_superadmin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_commission_rules_lookup ON tenant_commission_rules (tenant_id, effective_from DESC);

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM (
        'OPEN_DRAFT',
        'ISSUED_PENDING',
        'PARTIALLY_PAID',
        'PAID',
        'OVERDUE',
        'DISPUTED',
        'VOIDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    settlement_code VARCHAR(40) NOT NULL UNIQUE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    gross_sales_cents BIGINT NOT NULL DEFAULT 0,
    refunds_and_adjustments_cents BIGINT NOT NULL DEFAULT 0,
    commissionable_base_cents BIGINT NOT NULL DEFAULT 0 CHECK (commissionable_base_cents = gross_sales_cents - refunds_and_adjustments_cents),
    commission_due_cents BIGINT NOT NULL DEFAULT 0,
    amount_paid_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
    balance_due_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_due_cents = commission_due_cents - amount_paid_cents),
    status settlement_status NOT NULL DEFAULT 'ISSUED_PENDING',
    due_date DATE NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_status ON settlements (tenant_id, status, due_date);

DO $$ BEGIN
    CREATE TYPE ledger_entry_type AS ENUM (
        'ORDER_APPROVED',
        'REFUND_DEDUCTION',
        'POST_SETTLEMENT_REFUND_ADJUSTMENT',
        'CHARGEBACK_ADJUSTMENT',
        'MANUAL_ADMIN_ADJUSTMENT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS commission_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID,
    refund_id UUID,
    settlement_id UUID,
    entry_type ledger_entry_type NOT NULL,
    base_amount_cents BIGINT NOT NULL,
    commission_bps INTEGER NOT NULL,
    commission_amount_cents BIGINT NOT NULL,
    rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    description VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_ledger_order FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
    CONSTRAINT fk_ledger_refund FOREIGN KEY (tenant_id, refund_id) REFERENCES refunds (tenant_id, id),
    CONSTRAINT fk_ledger_settlement FOREIGN KEY (tenant_id, settlement_id) REFERENCES settlements (tenant_id, id),
    UNIQUE (tenant_id, id),
    UNIQUE NULLS NOT DISTINCT (tenant_id, entry_type, order_id, refund_id)
);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_unsettled ON commission_ledger (tenant_id, occurred_at) WHERE settlement_id IS NULL;

CREATE TABLE IF NOT EXISTS settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL,
    ledger_entry_id UUID NOT NULL UNIQUE,
    base_amount_cents BIGINT NOT NULL,
    commission_bps INTEGER NOT NULL,
    commission_amount_cents BIGINT NOT NULL,
    CONSTRAINT fk_settlement_items_settlement FOREIGN KEY (tenant_id, settlement_id) REFERENCES settlements (tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_settlement_items_ledger FOREIGN KEY (tenant_id, ledger_entry_id) REFERENCES commission_ledger (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS settlement_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    payment_method VARCHAR(40) NOT NULL CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER')),
    external_reference_number VARCHAR(120) NOT NULL,
    receipt_file_url TEXT,
    paid_at TIMESTAMPTZ NOT NULL,
    recorded_by_superadmin_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_settlement_payments_settlement FOREIGN KEY (tenant_id, settlement_id) REFERENCES settlements (tenant_id, id),
    UNIQUE (tenant_id, payment_method, external_reference_number)
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL,
    billing_period VARCHAR(7) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    paid_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_cents >= 0),
    status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(120),
    receipt_file_url TEXT,
    recorded_by_superadmin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sub_invoices_plan FOREIGN KEY (tenant_id, plan_id) REFERENCES tenant_plans (tenant_id, id),
    UNIQUE (tenant_id, billing_period)
);

-- ============================================================================
-- 6. AUDITORÍA ADMINISTRATIVA Y CONTROL DE WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id),
    actor_tenant_user_id UUID,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL DEFAULT 'MERCADOPAGO',
    external_event_id VARCHAR(120) NOT NULL,
    topic VARCHAR(40) NOT NULL,
    action VARCHAR(60) NOT NULL,
    mp_user_id BIGINT,
    tenant_id UUID REFERENCES tenants(id),
    resource_id VARCHAR(120) NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    processing_status VARCHAR(24) NOT NULL CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'IGNORED_DUPLICATE', 'FAILED')),
    payload JSONB NOT NULL,
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    UNIQUE (provider, external_event_id, action, resource_id)
);

-- ============================================================================
-- 7. POLÍTICAS ROW LEVEL SECURITY (RLS) ESTRICTAS Y FORZADAS
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'tenant_users', 'bar_stations', 'tenant_mp_credentials',
        'categories', 'products', 'orders', 'order_items',
        'stock_reservations', 'payment_transactions', 'refunds',
        'order_qrs', 'qr_redemption_logs', 'tenant_plans',
        'tenant_commission_rules', 'settlements', 'commission_ledger',
        'settlement_items', 'settlement_payments', 'subscription_invoices'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I
             FOR ALL
             TO PUBLIC
             USING (tenant_id = app_current_tenant_id() OR app_is_superadmin())
             WITH CHECK (tenant_id = app_current_tenant_id() OR app_is_superadmin());',
            tbl
        );
    END LOOP;
END $$;

-- Permisos para el rol de ejecución acotado app_runtime_user
GRANT USAGE ON SCHEMA public TO app_runtime_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime_user;
