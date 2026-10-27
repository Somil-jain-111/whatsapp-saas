# Relay production runbook

## Release order

1. Back up PostgreSQL and confirm the latest restore test succeeded.
2. Build one immutable application image.
3. Run `npm run migration:run:prod` once as a pre-deployment job.
4. Deploy the same image to staging and check `/api/v1/health/ready`.
5. Verify registration, login refresh, billing checkout, Meta onboarding, template submission, message delivery, and webhook processing.
6. Promote the same image to production and watch HTTP errors, queue depth, webhook failures, and message delivery failures.

Migrations must finish before new application instances start. Never enable TypeORM `synchronize` or automatic migrations in API replicas.

## Required external configuration

- PostgreSQL, Redis, encryption keys, JWT keys, object storage, and email delivery.
- One approved platform Meta Developer App and Embedded Signup configuration.
- A public HTTPS Meta webhook and a strong verification token.
- Razorpay key ID, key secret, webhook secret, and `RAZORPAY_STARTER_INR_PLAN_ID` for INR subscriptions.
- Stripe secret and webhook keys plus `STRIPE_STARTER_USD_PRICE_ID` when USD subscriptions are enabled.
- Configure the Razorpay webhook URL as `https://<api-domain>/webhooks/payments/razorpay` and subscribe to subscription and payment events.

Customers connect their own Meta Business Portfolio, WABA, and phone number through the platform Meta app. Customers must never enter a Meta App Secret.

## Rollback

Application releases must remain compatible with the current and immediately previous database schema. Roll back the application image first. Revert a migration only after confirming it has no customer data or active foreign-key references.

## Backup and recovery

- Take encrypted automated PostgreSQL backups with point-in-time recovery.
- Keep backups in a separate account or region.
- Test a restore at least monthly and record recovery time and the newest recovered transaction.
- Back up private object storage with versioning and retention enabled.

## Alerts

Alert on readiness failures, elevated 5xx rates, PostgreSQL or Redis saturation, queue backlog, failed/dead-letter jobs, Meta/payment webhook signature failures, and message delivery failure spikes.
