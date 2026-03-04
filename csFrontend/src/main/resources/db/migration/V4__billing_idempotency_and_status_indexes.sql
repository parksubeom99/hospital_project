-- Step4 Billing hardening (Flyway)
-- 목적: 결제 멱등성(중복 결제 방지) 운영 흔적 저장 + 조회 성능 보강 + 상태값 호환성 메모
-- 주의: 기존 JPA ddl-auto=update 환경과 공존하도록, 신규 테이블 중심으로 구성

CREATE TABLE IF NOT EXISTS admin_payment_idempotency (
    idem_key            VARCHAR(120) NOT NULL,
    invoice_id          BIGINT       NULL,
    payment_id          BIGINT       NULL,
    request_amount      BIGINT       NULL,
    request_method      VARCHAR(30)  NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        DATETIME     NULL,
    PRIMARY KEY (idem_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_pay_idem_invoice ON admin_payment_idempotency (invoice_id);
CREATE INDEX IF NOT EXISTS idx_admin_pay_idem_payment ON admin_payment_idempotency (payment_id);
CREATE INDEX IF NOT EXISTS idx_admin_pay_idem_status ON admin_payment_idempotency (status);

-- 결제/청구 상태 조회 보강 (존재 시 무시되는 IF NOT EXISTS 사용)
CREATE INDEX IF NOT EXISTS idx_admin_invoice_visit_status ON admin_invoice (visit_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_payment_invoice_status ON admin_payment (invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_visit_status_created ON admin_visit (status, created_at);
