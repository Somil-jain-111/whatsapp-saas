# Phase 3-4 data dictionary

The migrations are the authoritative column-level specification. IDs are UUIDs, instants are `TIMESTAMPTZ`, identifiers are bounded `VARCHAR`, structured metadata is size-checked `JSONB`, and financial values are integer minor units with ISO currency. Tenant tables carry `organization_id`, tenant-safe foreign keys, indexes, and forced RLS.

## Messaging and contacts

| Table                                                                       | Purpose                                                | Sensitive fields and protection                                                          | Retention/deletion                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `contacts`                                                                  | Tenant contact directory                               | Name/email/phone are PERSONAL_DATA; permission and RLS restricted; logs mask recipients. | Soft delete, then purge/anonymize under tenant privacy policy.                       |
| `contact_consents`                                                          | Purpose-specific opt-in/out history                    | Evidence is PERSONAL_DATA/CONFIDENTIAL.                                                  | Retain only for justified consent/audit period; imports never overwrite suppression. |
| `contact_tags`, `contact_tag_mappings`, `contact_segments`                  | Contact organization and validated segment definitions | CONFIDENTIAL tenant metadata; JSON size constrained.                                     | Cascade with owners where migration specifies.                                       |
| `contact_imports`, `contact_import_errors`                                  | Async import progress and safe errors                  | Object keys are INTERNAL; files private; error rows exclude phone/email.                 | Temporary objects follow import retention.                                           |
| `campaigns`, `campaign_recipients`, `campaign_schedules`, `message_batches` | Campaign definition and durable processing             | Parameters are CONFIDENTIAL and size constrained.                                        | Retain for configured messaging/audit period.                                        |
| `messages`, `message_status_events`                                         | Provider submission and monotonic status history       | Recipient/parameters are PERSONAL_DATA; provider errors are bounded/sanitized.           | Retain for configured messaging/audit period.                                        |
| `idempotency_records`, `outbox_events`                                      | Duplicate prevention and reliable queue handoff        | INTERNAL identifiers and bounded payloads.                                               | Purge after replay/idempotency windows.                                              |

## Billing and analytics

| Table                                                       | Purpose                               | Integrity/protection                                                                     | Retention/deletion                                             |
| ----------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `subscription_plans`, `plan_prices`, `plan_features`        | Global versioned product catalog      | Price/version uniqueness and effective-date checks.                                      | Deactivate/version; never rewrite historical price references. |
| `billing_customers`, `subscriptions`, `subscription_events` | Tenant/provider lifecycle             | Provider IDs are CONFIDENTIAL; immutable lifecycle events.                               | Contract/accounting retention; no silent cascade deletion.     |
| `payments`, `invoices`, `billing_adjustments`               | Reconciled financial history          | Exact amounts, unique provider IDs, tenant FKs, admin-approved adjustments; no card/CVV. | Tax/accounting policy and legal holds.                         |
| `payment_webhook_events`                                    | Signed-event deduplication            | Unique provider event ID and allow-listed bounded payload.                               | Purge after reconciliation/audit window.                       |
| `usage_records`, `usage_aggregates`, `quota_reservations`   | Idempotent metering and atomic quotas | Unique source keys, period checks, advisory-lock serialization.                          | Aggregate after raw-event audit window.                        |
| `messaging_price_versions`                                  | Effective-dated Meta pricing          | Exact amounts/source versions; historical rows immutable.                                | Retain while reports reference them.                           |
| `report_exports`                                            | Async export metadata                 | Tenant/user ownership and private object key.                                            | File expires after seven days.                                 |
| `billing_notifications`                                     | Durable notification outbox           | Bounded safe JSON and attempts; tenant RLS.                                              | Purge delivered/dead rows after operations window.             |

## Index rationale

- Tenant/time indexes support tenant history and pagination.
- Campaign/message composites support status aggregation and workers.
- Partial schedule/outbox/quota indexes support due work and active reservations.
- Provider IDs and source/event IDs are unique for reconciliation and replay safety.
- Usage, renewal, payment, invoice, and report indexes match customer/admin reads.

## Encryption matrix

| Data                                          | Method                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Meta tokens                                   | AES-256-GCM with tenant AAD and external key version; never logged/returned. |
| Passwords                                     | Argon2id verifier only.                                                      |
| Session/reset/verification/invitation secrets | Hash/verifier only.                                                          |
| Card data                                     | Never stored; Stripe-hosted surfaces.                                        |
| Import/report objects                         | TLS, encryption at rest, tenant authorization, private storage.              |

Application encryption/blind indexes for contact phone/email remain a threat-model decision because they trade off search, deduplication, analytics, and support. Encryption does not by itself establish regulatory compliance.
