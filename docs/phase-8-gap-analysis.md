# Phase 8 gap analysis, threat model and implementation plan

## Existing architecture

The repository is a NestJS modular monolith using TypeORM and PostgreSQL for the WhatsApp product modules, BullMQ/Redis for asynchronous work, and a React/Vite frontend. There is no Prisma schema and the frontend is not Next.js, so Phase 8 must extend the existing stack rather than introduce a second ORM or UI runtime.

Existing controls include tenant-scoped repositories, PostgreSQL row-level security on most tenant tables, tenant-aware foreign keys, bearer sessions with refresh-token rotation, platform-admin separation, Argon2 password hashing, AES-256-GCM field encryption, webhook signature verification, idempotent outbox processing, bounded BullMQ retries, API-key scoping, SSRF controls, private object storage, audit/security events, and health endpoints.

## Prioritized gaps

### Blockers

1. MFA storage exists but enrollment, verification, login enforcement, recovery and audit flows are absent.
2. Enterprise SSO is absent. No custom OIDC implementation should be written; production SSO requires a maintained OIDC client, state/nonce/PKCE persistence, strict issuer/audience/signature checks and invitation-bound account linking.
3. Tenant authorization does not currently include organization status in every membership check. A suspended organization can therefore retain some authenticated access.
4. Session lifetime is global. There is no tenant idle timeout, mandatory-MFA policy or bulk session revocation.
5. Privacy requests, verified review workflow, retention policies, legal holds and deletion execution records are absent.

### High priority

1. `GET /metrics` is a dependency health check rather than Prometheus metrics, and it labels PostgreSQL as MySQL.
2. Request IDs are generated twice by middleware/interceptor; worker jobs do not consistently carry them.
3. There is no graceful-shutdown hook in bootstrap.
4. Queue health covers only four queues and there is no shared backlog alert policy.
5. Data-region metadata exists, but all tenant data, logs, queues, object storage and backups still use one data plane. It must not be presented as residency compliance.
6. Backup configuration and successful restores are not recorded or independently verified.
7. Docker uses `npm install` despite a lockfile and has no runtime healthcheck or non-root user.
8. There is no repository CI pipeline.

### Scaling risks

1. High-volume tables have useful tenant/time indexes, but no measured query plans or production workload evidence exists.
2. Several list APIs still use offset pagination. High-volume logs and messages should move to keyset pagination before large deployments.
3. One Redis connection/data plane and one PostgreSQL writer remain shared failure domains.
4. Queue fairness is job-order based; a noisy tenant can consume shared workers.
5. Partitioning is premature without measured table growth, unique-key/FK analysis and tested migration procedures.

## Threat model

| Threat | Existing mitigation | Required Phase 8 control |
| --- | --- | --- |
| Cross-tenant access through client-selected tenant ID | Membership lookup and RLS | Include active organization status; regression tests; tenant-aware FKs for every new table |
| Stolen password/session | Argon2, access/refresh separation, revocation | TOTP MFA, idle timeout, policy-bound lifetime, login events, revoke-all |
| Unsafe SSO account linking | None | Invitation/existing-membership binding; verified IdP email; allowed domain; state, nonce and PKCE |
| Privileged support abuse | Separate platform admins | Time-bound grants, ticket/purpose, narrow scopes, visible indicator, immutable audit |
| Secret disclosure | AES-GCM and redacting logger | Encrypt OIDC secrets, retain no plaintext factors, rotation metadata, KMS migration path |
| Deletion of evidence needed for legal/security obligations | Ad-hoc retention metadata | Legal holds, reviewed privacy workflow, category-specific bounded deletion and immutable deletion logs |
| Retention of personal data forever | Some `expires_at` columns | Default policies, recurring bounded cleanup, backup/restore re-deletion runbook |
| False residency claim | Organization region label | Explicit control-plane/data-plane distinction and migration state; no compliance claim |
| Queue starvation/message storm | Quotas and bounded retries | Tenant fairness, concurrency caps, backlog/age alerts and emergency suspension |
| Provider ambiguity/duplicate send | Idempotency/outbox/provider IDs | Preserve `UNKNOWN_SUBMISSION`, reconciliation and no automatic ambiguous retry |
| Undetected outage | Basic health and logs | Readiness/liveness separation, metrics, alerts, trace propagation and restore evidence |

## Implementation plan

1. **Identity enforcement:** add organization security policy, TOTP enrollment/verification, login MFA challenge, session idle/lifetime enforcement and revoke-all with audit events.
2. **Enterprise control plane:** add tenant-scoped SSO configuration metadata, privacy requests/events, retention policies/deletion jobs, residency assignments, support grants and security incidents with RLS and strict constraints.
3. **Retention execution:** use a dedicated BullMQ queue; keep PostgreSQL as the durable job ledger; delete/anonymize in bounded, retry-safe batches and block work under legal hold.
4. **Operations:** add platform health/queue/incident/privacy/residency/backup APIs, Prometheus-compatible metrics, graceful shutdown, production Docker hardening and CI checks.
5. **UI:** add customer security, SSO, privacy, retention and organization/residency screens plus administrator platform health, incident/privacy and recovery screens. Every mutation must call an enforced backend endpoint.
6. **Regional migration:** keep the current cluster as `GLOBAL`; introduce regional control-plane routing only after regional PostgreSQL, Redis, object storage, encryption keys, logging and backups exist. Move tenants with a tested export/freeze/copy/verify/switch/rollback procedure.

## Migration strategy

The migration is additive. New tenant tables use UUID keys, bounded fields, `TIMESTAMPTZ`, tenant-scoped indexes/FKs and forced RLS. Default policy rows are backfilled for active organizations. Existing sessions remain valid under platform defaults until a tenant policy is changed. Destructive data processing is never performed by the schema migration; retention work is represented by durable jobs and executed later in small batches. Rollback refuses to remove controls while dependent records exist.

## Compliance boundary

These controls provide technical readiness only. GDPR/UK GDPR, India's DPDP framework, CCPA/CPRA, LGPD and communications obligations require jurisdiction-specific legal review, documented operational procedures, vendor/subprocessor review and verified deployment configuration. A database region label alone is not evidence of data residency.
