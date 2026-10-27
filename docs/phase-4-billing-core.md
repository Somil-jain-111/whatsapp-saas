# Phase 4 billing, entitlements, analytics, and reports

## Billing boundary

SaaS subscription revenue and Meta messaging costs are separate. SaaS amounts use integer minor units and ISO currency codes; no floating-point arithmetic is used. Messaging costs are returned only as `ESTIMATED` when a matching effective-dated rate exists, otherwise `UNAVAILABLE`.

## Subscription flow

1. Super Admin creates an immutable plan version with effective-dated regional prices and feature quotas.
2. A customer starts a one-time trial from a trial-enabled plan with a zero-price record, or creates a Stripe-hosted Checkout session.
3. Browser callbacks never activate access. Timestamped Stripe HMAC webhooks are allow-list persisted and deduplicated.
4. Subscription, invoice, payment, refund, notification, and immutable subscription-event records update transactionally.
5. Upgrades/downgrades, cancellation, reactivation, and payment-method management use Stripe's hosted/provider APIs. Provider webhook state remains authoritative.

Required provider events include Checkout Session completion, customer subscription lifecycle, invoice lifecycle/payment events, and charge refunds.

## Entitlements and usage

`EntitlementService` is the backend enforcement point for feature availability and quota reservations. PostgreSQL advisory transaction locks serialize reservations per organization and metric. Idempotent commit creates one durable usage record; release frees unused quota. Message, campaign, and report-export paths enforce quotas before accepting work.

Trial expiry is processed hourly. `PAST_DUE` access is limited by its current subscription period; no resources are deleted during a downgrade or expiry.

## Analytics and exports

Analytics endpoints calculate campaign, message, template, and cost metrics from durable message/status data. Report exports support CSV, XLSX, and PDF. Workers query in 1,000-row batches, neutralize spreadsheet formulas, write to private storage, and expose files only through an authenticated tenant-scoped download route. Development storage is `.private-storage/`; production uses server-side-encrypted S3 objects.

## Administration

`/internal/admin/v1` requires both a valid access session and an active `platform_admins` record. It exposes the platform overview, paginated customer summaries, free-trial usage, customer subscription and delivery details, tenant audit logs, path-only user journeys and billing-funnel events, billing overview, subscriptions, invoices, payments, revenue, global usage, messaging analytics, plan version creation/update, approved adjustments, Meta health/errors/templates, report jobs, and BullMQ queue health. Customer data is read-only on these overview endpoints and remains protected by the platform-admin guard. Journey tracking never stores query strings, form values, message content, or credentials.

## Configuration

See `.env.example`. Enabling billing requires the Stripe API URL, secret key, webhook secret, Checkout URLs, and portal return URL. Production also requires private S3 configuration. Secrets must be injected from a secret manager and never committed.

## Accounting and retention

- Existing subscriptions retain their original plan/price references; price changes require a new plan version.
- Provider event IDs, payments, invoices, usage sources, and quota idempotency keys are unique.
- Financial adjustments are additive audit records approved by a platform administrator; historical invoices/payments are not overwritten except for provider reconciliation of the same immutable provider identifier.
- Report objects expire after seven days. Database and object-retention jobs should be aligned with the policies in `docs/retention-policy.md`.
