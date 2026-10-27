# Phase 1 schema and data dictionary

Notation: `PK`, `FK`, `UQ`, `NN`; timestamps are UTC instants. All IDs are UUID. Status columns are database-checked. Examples in parentheses show valid / invalid values.

## `users` (global identity)

| Column                                       | Type         | Null/default/key/index          | Class, validation and purpose                                     |
| -------------------------------------------- | ------------ | ------------------------------- | ----------------------------------------------------------------- |
| id                                           | uuid         | PK, `gen_random_uuid()`         | PERSONAL_DATA pseudonymous identifier                             |
| email_normalized                             | varchar(254) | NN, UQ                          | PERSONAL_DATA; lowercase trimmed identity (`a@b.com` / `A@B.COM`) |
| email_display                                | varchar(254) | NN                              | PERSONAL_DATA; user-facing email                                  |
| full_name                                    | varchar(150) | NN                              | PERSONAL_DATA; trimmed nonblank (`Ana` / blank)                   |
| phone_e164                                   | varchar(16)  | null                            | PERSONAL_DATA; `+` and 2–15 digits (`+14155552671` / `415...`)    |
| phone_country_code                           | char(2)      | null, FK country                | PERSONAL_DATA; required with phone (`US` / `ZZ`)                  |
| phone_verified_at                            | timestamptz  | null                            | PERSONAL_DATA; verification instant                               |
| password_hash                                | varchar(255) | null, hidden                    | AUTHENTICATION_DATA; Argon2id only                                |
| status                                       | varchar(30)  | `PENDING_VERIFICATION`, indexed | INTERNAL; allowed lifecycle values                                |
| email_verified_at, last_login_at, deleted_at | timestamptz  | null                            | PERSONAL_DATA/internal lifecycle instants                         |
| created_at, updated_at                       | timestamptz  | `now()`                         | INTERNAL lifecycle                                                |

## `organizations` (tenant root)

| Column                 | Type         | Null/default/key/index | Class, validation and purpose                                 |
| ---------------------- | ------------ | ---------------------- | ------------------------------------------------------------- |
| id                     | uuid         | PK                     | CONFIDENTIAL tenant ID and RLS key                            |
| name                   | varchar(200) | NN                     | CONFIDENTIAL, nonblank                                        |
| slug                   | varchar(100) | NN, UQ                 | PUBLIC routing key, lowercase kebab form (`acme-in` / `Acme`) |
| country_code           | char(2)      | NN, FK                 | CONFIDENTIAL; maintained ISO reference                        |
| currency_code          | char(3)      | NN, FK                 | CONFIDENTIAL; maintained ISO reference                        |
| timezone               | varchar(64)  | NN                     | CONFIDENTIAL; application validates IANA value                |
| data_region            | varchar(30)  | `GLOBAL`               | CONFIDENTIAL; controlled deployment region                    |
| status                 | varchar(30)  | `ACTIVE`, indexed      | INTERNAL lifecycle                                            |
| deleted_at             | timestamptz  | null                   | INTERNAL deletion workflow                                    |
| created_at, updated_at | timestamptz  | `now()`                | INTERNAL lifecycle                                            |

## Access control

| Table.column                                 | Type         | Null/default/key/index  | Class, validation and purpose                               |
| -------------------------------------------- | ------------ | ----------------------- | ----------------------------------------------------------- |
| roles.id                                     | uuid         | PK                      | INTERNAL role ID                                            |
| roles.organization_id                        | uuid         | null, FK, indexed       | CONFIDENTIAL custom-role owner; null for templates/platform |
| roles.name                                   | varchar(50)  | NN                      | INTERNAL display name                                       |
| roles.code                                   | varchar(100) | NN, partial UQ          | INTERNAL stable code                                        |
| roles.scope                                  | varchar(30)  | NN                      | INTERNAL `ORGANIZATION`/`PLATFORM`                          |
| roles.status                                 | varchar(30)  | `ACTIVE`                | INTERNAL lifecycle                                          |
| roles.is_system                              | boolean      | false                   | INTERNAL seed protection marker                             |
| roles.created_at, updated_at                 | timestamptz  | `now()`                 | INTERNAL lifecycle                                          |
| permissions.id                               | uuid         | PK                      | INTERNAL                                                    |
| permissions.code                             | varchar(100) | NN, UQ                  | INTERNAL stable permission code                             |
| permissions.name                             | varchar(150) | NN                      | INTERNAL display name                                       |
| permissions.description                      | varchar(500) | null                    | INTERNAL bounded description                                |
| permissions.status                           | varchar(30)  | `ACTIVE`                | INTERNAL lifecycle                                          |
| permissions.created_at                       | timestamptz  | `now()`                 | INTERNAL                                                    |
| role_permissions.id                          | uuid         | PK                      | INTERNAL                                                    |
| role_permissions.role_id, permission_id      | uuid         | NN, FK, pair UQ         | CONFIDENTIAL grant mapping                                  |
| role_permissions.created_at                  | timestamptz  | `now()`                 | INTERNAL                                                    |
| organization_members.id                      | uuid         | PK                      | PERSONAL_DATA association ID                                |
| organization_members.organization_id         | uuid         | NN, FK, indexed         | CONFIDENTIAL tenant owner                                   |
| organization_members.user_id                 | uuid         | NN, FK, pair UQ/indexed | PERSONAL_DATA member                                        |
| organization_members.role_id                 | uuid         | NN, FK/indexed          | CONFIDENTIAL assignable role; trigger checked               |
| organization_members.status                  | varchar(30)  | `ACTIVE`                | CONFIDENTIAL lifecycle                                      |
| organization_members.invited_by_user_id      | uuid         | null, FK                | PERSONAL_DATA inviter                                       |
| organization_members.joined_at, suspended_at | timestamptz  | now/null                | PERSONAL_DATA lifecycle                                     |
| organization_members.created_at, updated_at  | timestamptz  | `now()`                 | INTERNAL lifecycle                                          |

## Invitations and authentication

| Table.column                           | Type          | Null/default/key/index | Class, validation and purpose                      |
| -------------------------------------- | ------------- | ---------------------- | -------------------------------------------------- |
| invitations.id                         | uuid          | PK                     | CONFIDENTIAL                                       |
| invitations.organization_id            | uuid          | NN, FK/indexed         | CONFIDENTIAL tenant                                |
| invitations.email_normalized           | varchar(254)  | NN, pending pair UQ    | PERSONAL_DATA recipient                            |
| invitations.role_id                    | uuid          | NN, FK                 | CONFIDENTIAL proposed role, tenant trigger checked |
| invitations.token_hash                 | char(64)      | NN, UQ, hidden         | AUTHENTICATION_DATA keyed verifier                 |
| invitations.status                     | varchar(30)   | `PENDING`              | INTERNAL lifecycle                                 |
| invitations.invited_by_user_id         | uuid          | NN, FK                 | PERSONAL_DATA inviter                              |
| invitations.expires_at, accepted_at    | timestamptz   | NN/null                | AUTHENTICATION_DATA validity/use                   |
| invitations.created_at, updated_at     | timestamptz   | `now()`                | INTERNAL                                           |
| sessions.id                            | uuid          | PK                     | AUTHENTICATION_DATA session ID                     |
| sessions.user_id                       | uuid          | NN, FK/indexed         | PERSONAL_DATA owner                                |
| sessions.token_hash                    | char(64)      | NN, UQ, hidden         | AUTHENTICATION_DATA keyed verifier                 |
| sessions.ip_address                    | inet          | null                   | PERSONAL_DATA source address                       |
| sessions.user_agent                    | varchar(1024) | null                   | PERSONAL_DATA bounded client description           |
| sessions.expires_at                    | timestamptz   | NN/indexed             | AUTHENTICATION_DATA, after creation                |
| sessions.revoked_at                    | timestamptz   | null/partial index     | AUTHENTICATION_DATA invalidation                   |
| sessions.revocation_reason             | varchar(100)  | null                   | INTERNAL bounded reason                            |
| sessions.last_seen_at, created_at      | timestamptz   | null/now               | PERSONAL_DATA lifecycle                            |
| email_verifications/password_resets.id | uuid          | PK                     | AUTHENTICATION_DATA                                |
| `.user_id`                             | uuid          | NN, FK/indexed         | PERSONAL_DATA owner                                |
| `.token_hash`                          | char(64)      | NN, UQ, hidden         | AUTHENTICATION_DATA keyed verifier                 |
| `.expires_at`                          | timestamptz   | NN/indexed             | AUTHENTICATION_DATA, after creation                |
| `.consumed_at`                         | timestamptz   | null                   | AUTHENTICATION_DATA single-use marker              |
| `.created_at`                          | timestamptz   | `now()`                | INTERNAL                                           |

## MFA, platform administration, audit and security

| Table.column                                   | Type         | Null/default/key/index | Class, validation and purpose                   |
| ---------------------------------------------- | ------------ | ---------------------- | ----------------------------------------------- |
| user_mfa_factors.id, user_id                   | uuid         | PK / NN FK indexed     | AUTHENTICATION_DATA factor and owner            |
| user_mfa_factors.type                          | varchar(30)  | NN                     | AUTHENTICATION_DATA `TOTP`/`WEBAUTHN`           |
| user_mfa_factors.name                          | varchar(100) | NN, per-user UQ        | PERSONAL_DATA device label                      |
| secret_ciphertext                              | bytea        | NN, hidden             | RESTRICTED_SECRET AES-GCM ciphertext            |
| secret_nonce                                   | bytea        | NN, 12 bytes, hidden   | RESTRICTED_SECRET unique nonce                  |
| secret_auth_tag                                | bytea        | NN, 16 bytes, hidden   | RESTRICTED_SECRET authentication tag            |
| key_version                                    | varchar(50)  | NN                     | RESTRICTED_SECRET external KMS key version      |
| status                                         | varchar(30)  | `PENDING`, indexed     | AUTHENTICATION_DATA lifecycle                   |
| verified_at, created_at, updated_at            | timestamptz  | null/now               | AUTHENTICATION_DATA lifecycle                   |
| platform_admins.id, user_id                    | uuid         | PK / NN FK UQ          | CONFIDENTIAL separated elevation                |
| platform_admins.role                           | varchar(30)  | NN                     | CONFIDENTIAL controlled platform role           |
| platform_admins.status                         | varchar(30)  | `ACTIVE`, indexed      | CONFIDENTIAL lifecycle                          |
| granted_by_admin_id                            | uuid         | null, self FK          | CONFIDENTIAL approval chain                     |
| granted_at, revoked_at, created_at, updated_at | timestamptz  | now/null               | CONFIDENTIAL lifecycle                          |
| audit_logs.id                                  | uuid         | PK                     | INTERNAL immutable event ID                     |
| audit_logs.organization_id                     | uuid         | null, FK/indexed       | CONFIDENTIAL tenant scope                       |
| actor_user_id, actor_platform_admin_id         | uuid         | null, FK/indexed       | PERSONAL_DATA actor; null supports system event |
| action, resource_type                          | varchar(100) | NN                     | INTERNAL bounded event vocabulary               |
| resource_id                                    | uuid         | null                   | CONFIDENTIAL target ID                          |
| ip_address                                     | inet         | null                   | PERSONAL_DATA source                            |
| request_id                                     | varchar(100) | null/indexed           | INTERNAL correlation ID                         |
| metadata                                       | jsonb        | `{}`, object <=32 KiB  | CONFIDENTIAL redacted structured context        |
| created_at                                     | timestamptz  | `now()`, indexed       | INTERNAL immutable instant                      |
| security_events.id                             | uuid         | PK                     | CONFIDENTIAL event ID                           |
| organization_id, user_id                       | uuid         | null, FK/indexed       | PERSONAL_DATA/CONFIDENTIAL scope                |
| event_type                                     | varchar(100) | NN                     | INTERNAL controlled event name                  |
| severity                                       | varchar(20)  | NN/indexed             | INTERNAL allowed severity                       |
| ip_address                                     | inet         | null                   | PERSONAL_DATA source                            |
| request_id                                     | varchar(100) | null                   | INTERNAL correlation                            |
| metadata                                       | jsonb        | `{}`, object <=32 KiB  | CONFIDENTIAL redacted context                   |
| resolved_at, created_at                        | timestamptz  | null/now               | INTERNAL lifecycle                              |

## Reference data

`iso_countries(code char(2) PK, name varchar(100) NN)` and `iso_currencies(code char(3) PK, name varchar(100) NN, minor_units smallint NN 0..4)` are migration/seed-controlled PUBLIC reference data. Unknown codes fail foreign keys (`US`, `USD` valid after seed; `ZZ`, `ZZZ` invalid).
