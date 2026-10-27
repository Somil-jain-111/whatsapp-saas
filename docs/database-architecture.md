# Phase 1 database architecture and gap analysis

## Decision

Phase 1 reuses the existing NestJS TypeORM connection. Adding Prisma would create two units of work, two entity models, and unsafe migration ownership, so it was deliberately not added. PostgreSQL objects are isolated in `whatsapp_core`; this prevents collisions with the legacy commerce tables in `public` while using the same connection pool and transaction manager.

## Inspection findings

| Finding                                                                            | Severity                  | Resolution                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Source uses TypeORM and supports MySQL/PostgreSQL; Prisma is absent                | High                      | Keep TypeORM; PostgreSQL migration fails fast on another driver                                                      |
| `src/migrations` was absent while 51 compiled migrations remain in `dist`          | Critical                  | New migration is versioned in source; recover the old source migrations before deploying the legacy app from scratch |
| Legacy compiled `users` stores OTPs, reset tokens and refresh tokens directly      | Blocker for reuse         | Phase 1 uses isolated tables and only keyed token hashes; it does not migrate legacy credentials                     |
| Legacy user phone is split into dial code/mobile and has no canonical E.164 check  | High                      | `phone_e164` plus country FK and database regex                                                                      |
| Legacy auth data uses global numeric IDs and has no tenant owner                   | Blocker for multi-tenancy | UUIDs, organization membership, RLS, tenant triggers                                                                 |
| PostgreSQL driver was missing                                                      | High                      | Added `pg`; shared connection remains authoritative                                                                  |
| Application source imported absent commerce modules and orphaned legacy auth files | High                      | Removed stale registrations and excluded only unreachable legacy auth files; the Phase 1 application now builds      |
| Existing configuration has development credential fallbacks                        | High                      | No new fallback was added; production should require PostgreSQL credentials before rollout                           |

## Boundaries

- Global: users, permissions, sessions, verification/reset records, platform admins, ISO reference data.
- Tenant-owned: organizations, memberships, custom roles, invitations, tenant audit/security records.
- Shared role templates have `organization_id IS NULL`, scope `ORGANIZATION`, and are immutable operational seed data.
- Platform administrators are a separate table; membership roles cannot grant platform privilege.
- Phase 2 messaging, Meta credentials, billing and campaign data are intentionally absent.
- Excluded legacy auth files are not a compatibility layer. Restore their complete source and migrate them intentionally if the old commerce application must coexist.

## Write model

Organization creation and its first owner are one transaction. A deferred trigger rejects organizations without an active owner. Role assignment triggers reject platform, inactive, or cross-tenant roles. Last-owner removal takes a transaction advisory lock, closing the concurrent-delete race.

## Availability and recovery

Use managed PostgreSQL 15+ with multi-AZ failover, encrypted storage, TLS verification, point-in-time recovery, daily logical metadata checks, and quarterly restore drills. Proposed initial targets: RPO 5 minutes and RTO 60 minutes; the business owner must approve them.
