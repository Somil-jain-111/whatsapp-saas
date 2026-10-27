# Migration, deployment, backup and bootstrap guide

## Phase migration order

1. `1792401000000-CreateWhatsappPhaseOneIdentity`
2. `1792487400000-CreateWhatsappPhaseTwoIntegration`
3. `1792573800000-CreateSaasBillingCore`
4. `1792660200000-CreateMessagingContactsCampaigns`
5. `1792746600000-CompleteBillingAnalytics`
6. `1792833000000-StrengthenPhase34Integrity`

Run `NODE_ENV=development npm run migration:show` before and after `npm run migration:run`. Production uses forward recovery: take a verified backup, apply migrations from a dedicated job, then enable dependent workers/routes. Never automatically reset production.

## Deploy

1. Take and verify a PostgreSQL backup; record restore point and migration version.
2. Deploy code that is compatible with both pre/post migration state.
3. Run `DB_TYPE=postgres npm run migration:run` once from a dedicated migration job.
4. Run `npm run seed:phase1`; it is idempotent and contains no account credentials.
5. Validate tables, constraints, RLS policies, seed counts and application readiness before routing traffic.

The migration is additive and uses a new schema. No legacy columns/tables are dropped or renamed. `down` drops the entire Phase 1 schema and is for controlled non-production rollback only; after data exists, prefer forward recovery.

## First platform administrator

Create and verify a normal user through the approved identity flow. Under two-person operational approval, insert one `platform_admins` row in a logged transaction using a break-glass database role, then immediately revoke that role/session and verify an immutable audit/security event. Never seed or email a shared password.

## Backup and restore

- Encrypted continuous WAL/PITR plus daily snapshots in a separate account/region where residency permits.
- Alert on failed backups and replication lag.
- Quarterly restore into an isolated account, run integrity/security tests, measure RPO/RTO, and destroy the restored personal data afterward.
- On restore, replay approved erasure tombstones and rotate exposed credentials before reopening service.
