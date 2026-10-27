# Phase 5 gap analysis and implementation plan

## Completion status

The implementation plan below is complete. The final security extension adds:

- OAuth 2.0 client-credentials exchange at `POST /public/oauth/token` with five-minute, scope-restricted access tokens. The API key public identifier is the client ID and the one-time API key is the client secret; revocation, expiry, tenant status, subscription, IP rules and mTLS are rechecked against the database on API requests.
- Optional HMAC-SHA256 request authentication using the one-time encrypted signing secret. The signature covers the timestamp, uppercase method, exact path/query and SHA-256 of the exact request bytes. A five-minute clock window and Redis replay lock are enforced.
- Optional per-credential mTLS certificate pinning. When certificate fingerprints are configured, the application requires a CA-validated client certificate from the direct TLS socket and matches its SHA-256 fingerprint. Nest must terminate TLS directly with `TLS_CERT_PATH`, `TLS_KEY_PATH` and `MTLS_CA_PATH`; unverified proxy headers are deliberately not trusted.
- A transactionally enforced customer monthly API messaging spend cap. Reservations use current country/category pricing, a tenant advisory lock and a unique operation key so concurrent or retried requests cannot overspend or double-count.

Existing keys remain valid for Bearer authentication. Rotate an existing key once to receive its one-time HMAC signing secret; existing credentials are not assigned recoverable plaintext secrets retroactively.

## Existing capabilities to reuse

- NestJS modular monolith with TypeORM/PostgreSQL migrations and row-level tenant policies. The repository does not use Prisma, so Phase 5 will continue with TypeORM rather than add a second ORM.
- Session authentication, tenant permission guards, audit logging, encrypted-field storage, Redis, BullMQ, billing entitlements and quotas.
- Messaging, templates, campaigns, analytics and Meta Cloud API dispatch services. Public APIs must delegate to these services rather than call Meta directly.
- Database-backed message operation keys and transactional outbox records.
- React/Vite frontend and the existing design system. The repository does not use Next.js, so the developer portal will extend the current frontend.
- Swagger/OpenAPI generation and the standard error/response interceptors.

## Gaps

- No customer-managed public API credentials, scopes, IP allowlists, rotation history or emergency tenant API switch.
- No Bearer API-key principal or public API authorization guard.
- Existing message idempotency does not fingerprint requests, distinguish conflicting retries, or scope keys to an API credential.
- No per-key/per-tenant public API limiter or safe public request log.
- No public `/public/v1` contract, downloadable integration artifacts, sandbox isolation or developer portal UI.
- No customer webhook endpoint, subscription, signed delivery, retry/replay or delivery-health feature.
- Swagger currently emits OpenAPI 3.0 and rewrites successful responses to 200; Phase 5 requires an explicit public OpenAPI contract including 202 responses.
- No super-admin public API inventory, suspension or abuse view.

## Implementation order

1. Add tenant-owned Phase 5 tables, constraints, indexes, RLS policies, retention metadata and an organization API-disable switch.
2. Implement secure API-key lifecycle: 256-bit secrets, keyed verifier, one-time display, scopes, expiry, CIDR allowlists, rotation and immediate revocation with audit events.
3. Add the public API guard, Redis rate limits, subscription/status checks, safe request logging and scoped `/public/v1` endpoints that reuse existing services.
4. Add fingerprinted transactional idempotency and an isolated deterministic sandbox path that never dispatches to Meta.
5. Add encrypted webhook secrets, SSRF-safe HTTPS delivery, HMAC signatures, BullMQ retries, logs, disablement and replay.
6. Publish an OpenAPI 3.1 document and generated Postman collection, then add the eight responsive developer screens and super-admin monitoring.
7. Test authentication failures, scope and tenant isolation, idempotency, rate limits, sandbox isolation, webhook signatures/SSRF, build, lint and migrations.

## Compatibility and safety decisions

- Existing customer/session APIs remain under `/api/v1`; only server-to-server endpoints use `/public/v1`.
- API key plaintext is returned once and is never persisted or logged.
- Test credentials cannot reach the production message service. Production sends retain existing consent, sender, template and billing checks.
- Public request logs store metadata only; authorization headers and message/template parameters are excluded.
