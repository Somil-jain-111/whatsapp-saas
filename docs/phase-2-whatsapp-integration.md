# Phase 2: Meta WhatsApp integration

## Architecture

Phase 2 extends the existing NestJS/TypeORM modular monolith. It deliberately does not add Prisma or a second authentication system.

- `whatsapp-integration` owns Meta onboarding, accounts, phone numbers, templates, health, and webhooks.
- `MetaGraphProvider` is the only outbound Meta API adapter. Reads have a three-attempt bounded retry; writes are never blindly retried.
- Recoverable access credentials use AES-256-GCM through the existing field-encryption boundary. Production should inject the 32-byte data key from a secret manager or KMS sidecar; it is never stored in PostgreSQL.
- Every customer request requires a live Phase 1 session, an `x-organization-id` header, active membership, and the route permission.
- Tenant-owned tables use composite foreign keys and PostgreSQL RLS. Provider WABA and phone-number IDs are globally unique to prevent silent cross-tenant assignment.
- Webhooks verify `X-Hub-Signature-256` against the raw request bytes, persist an allow-listed/redacted event, deduplicate by SHA-256, and enqueue processing in BullMQ.
- Templates keep local and provider status separately. Each edit creates immutable component/version rows. Provider-write uncertainty queues reconciliation instead of retrying creation.

## Setup

1. Apply both TypeORM migrations in order.
2. Run `npm run seed:phase1` to install Phase 2 permissions into the existing system roles.
3. Configure all `META_*` values from `.env.example`; set `META_INTEGRATION_ENABLED=true` only after they are valid.
4. Configure Meta's callback as `/webhooks/meta`; this route intentionally sits outside the `/api/v1` prefix.
5. Ensure Redis is reachable for webhook processing.

The API contract is in `docs/openapi/phase-2.yaml`.

## Security and data handling

Credential columns are excluded from normal ORM selects. Responses never contain tokens. Raw provider responses are not persisted. Webhook payloads retain only Phase 2 identifiers and status fields and expire after `META_WEBHOOK_RETENTION_DAYS` (default 30 days). Integration errors and sync jobs should be removed after 90 days by the platform retention job; template versions and audit logs follow the business/legal retention policy.

Disconnect destroys the locally recoverable credential but preserves accounts and template history. A provider-side revocation endpoint is not called because Meta's current requirements could not be verified from the supplied material; perform revocation in Meta Business Manager until that operation is contract-tested.

## Frontend boundary

No frontend project exists in this repository, and the supplied brief ends midway through Screen 2. Do not create an unreviewed second application. A future Next.js dashboard should consume the OpenAPI contract and implement the confirmed Connect Meta wizard first. Never receive the app secret or stored access token in browser code. Render template text as text, not HTML, and label previews as approximate.

## Operations

Alert on repeated `DEGRADED`/`ACTION_REQUIRED` connections, unresolved integration errors, dead sync jobs, and failed webhook jobs. Back up PostgreSQL normally; encrypted credentials are only recoverable while the corresponding external key version is retained. Test restore and key-recovery procedures before production.

## Known handoff gaps

- Phase 1 does not currently expose a working login/token issuer. Customer routes intentionally fail closed and expect an HS256 access token with `sub`, `sid`, and `type: access`, backed by an active Phase 1 session. Wire the existing issuer to that contract before UI integration.
- Manual sync endpoints create durable `integration_sync_jobs`, but this repository does not yet include the provider reconciliation worker or a scheduled dispatcher. Webhook jobs are processed by BullMQ.
- The source brief is truncated after the heading for frontend Screen 2, and no frontend exists here. The remaining screens were not invented.
- Live Meta onboarding, permissions, media upload handles, and template payloads require sandbox contract tests before production. Meta's official documentation returned HTTP 429 during implementation, so no API version was guessed.
