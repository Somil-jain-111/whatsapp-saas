# Phase 8 enterprise readiness

## Scope and status

This release adds enforceable tenant security policies, TOTP MFA, session controls, encrypted OIDC connection configuration and discovery validation, privacy-request tracking, bounded retention jobs, explicit residency state, incident tracking, restore-verification evidence, health probes, hardened container execution and CI checks.

It is **technical readiness, not a compliance certification**. The service still uses one PostgreSQL/Redis/object-storage data plane. A tenant with `requestedRegion=EU` and `actualRegion=GLOBAL` has requested placement; the platform must not describe that tenant as EU-resident.

OIDC connection testing verifies HTTPS/public destinations and exact discovery issuer metadata. It does not yet provide an OIDC login/callback runtime, PKCE transaction store or account-provisioning flow, so SSO must not be advertised as available for sign-in.

## Enforced controls

- Tenant access requires an active organization and active membership.
- Organization policy can require enrolled TOTP MFA, cap session lifetime, apply an idle timeout and disable password-authenticated tenant sessions.
- MFA secrets are shown once, stored with authenticated encryption and destroyed on revocation.
- Privacy requests require password reauthentication and retain an event history.
- Retention scans use BullMQ only as a scheduler; PostgreSQL remains the durable job ledger.
- Implemented deletion categories run in 500-row batches: message content is cryptographically stripped, API request logs are deleted and security-event identifying metadata is anonymized.
- Legal hold prevents new retention jobs from being scheduled or executed.
- Administrative incident, privacy-review and backup-evidence mutations require a security-administrator role.
- Liveness is process-only. Readiness checks PostgreSQL, Redis and the application cache and returns HTTP 503 when unavailable.
- The production container uses the lockfile, runs as the unprivileged `node` user and exposes a liveness health check.

## Privacy operations

1. Verify the requester outside the application when the organization cannot reliably bind the request to an authenticated account.
2. Record the request and jurisdiction; do not treat the calculated due date as legal advice.
3. Review scope, identity, legal holds, billing/security retention obligations and downstream processors.
4. Move the request through review states with a reason. An `APPROVED` status is not evidence that data has been exported or erased.
5. Execute and independently verify the applicable export, correction or erasure procedure before marking it `COMPLETED`.
6. If a backup is restored, reapply completed erasure obligations before reopening customer access.

Technical controls should be reviewed with the official [EU GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/), [UK ICO individual-rights guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/), [India DPDP Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023-1.pdf), [California Attorney General CCPA guidance](https://oag.ca.gov/privacy/ccpa), and [Brazil ANPD data-subject guidance](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares). Legal counsel must confirm the applicable obligations and response timelines.

## Regional data-plane migration

1. Provision a complete regional data plane: PostgreSQL, Redis/queues, private object storage, encryption keys, logs, monitoring and backups.
2. Stop tenant writes and drain tenant jobs using an audited maintenance workflow.
3. Export by tenant ownership, transfer over authenticated encrypted channels, import, and verify counts, hashes, foreign keys and object references.
4. Switch control-plane routing only after application, worker, webhook and restore tests pass in the destination region.
5. Keep a time-bounded encrypted rollback copy; then delete it under the approved transfer/retention policy.
6. Set residency status to `VERIFIED` only with evidence covering storage, processing, logs, backups and support access.

## Backup and recovery runbook

The repository records restore evidence but does not create cloud backups. Infrastructure owners must configure encrypted database PITR, object versioning/lifecycle, Redis recovery appropriate to queue durability, and recoverable secret/KMS procedures.

For every restore exercise:

1. Open an incident/change record and identify the backup reference and target isolated environment.
2. Restore with production credentials disabled and outbound messaging blocked.
3. Validate schema migrations, tenant isolation, row counts, message/outbox invariants and representative encrypted records.
4. Reapply post-backup privacy deletions and revoked credentials.
5. Record `PASSED` only after functional and integrity verification; record failures without overwriting prior evidence.
6. Destroy the isolated copy under the temporary-data policy.

RPO and RTO are deployment-specific targets, not guarantees. They must be established from provider capabilities, backup frequency, measured restore exercises and business approval.

## Deployment order and rollback

1. Back up and verify the target database.
2. Apply the additive Phase 8 migration before deploying application code.
3. Deploy API instances, then workers, then the frontend; watch readiness, error rate and queue age.
4. Enable tenant policies incrementally. Requiring MFA is rejected until every active member has enrolled.
5. Roll application code back independently while retaining additive tables. Use the migration `down` only in a controlled non-production rollback because it deletes Phase 8 records.

## Operational alerts to configure

- API 5xx rate and p95/p99 latency
- PostgreSQL availability, pool saturation, slow queries and replica lag
- Redis availability and memory pressure
- queue waiting/failed counts and oldest-job age
- Meta, payment and outbound-webhook error rates
- overdue privacy requests and failed deletion jobs
- open critical incidents
- missed or failed backup/restore verification
- expiring Meta/API/OIDC credentials

Alert thresholds must be based on measured traffic and a documented on-call action; this repository intentionally does not invent production thresholds.
