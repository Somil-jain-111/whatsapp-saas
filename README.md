# WhatsApp Business SaaS backend

NestJS modular backend for multi-tenant identity, Meta WhatsApp onboarding and templates, contacts, campaigns, asynchronous messaging, billing, quotas, analytics, and report exports.

## Local setup

1. Copy `.env.example` to `.env.development` and provide local PostgreSQL and Redis settings.
2. Create the PostgreSQL database and run `npm run migration:run`.
3. Run `npm run seed:phase1` to seed permissions and reference data.
4. Bootstrap the first local account by supplying `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD`, `BOOTSTRAP_FULL_NAME`, `BOOTSTRAP_ORGANIZATION_NAME`, and `BOOTSTRAP_ORGANIZATION_SLUG` to `npm run bootstrap:phase1-account`. Set `BOOTSTRAP_PLATFORM_ADMIN=true` only for an approved first platform administrator. The command never stores or prints the password.
5. Start PostgreSQL and Redis, then run `npm run start:dev`.

Use `npm run start:local` only for legacy/local MySQL compatibility. Phase 1-4 business modules and PostgreSQL migrations are intentionally unavailable in MySQL mode.

## Verification

```sh
npm run build
npm test
npm run lint
npm run migration:show
```

Production deployment, migration, rollback, backup, and alerting steps are in
[`docs/production-runbook.md`](docs/production-runbook.md).

Swagger is available at the configured `SWAGGER_PATH` outside production. API contracts and architecture notes are under `docs/`.

## Security

Never commit `.env` files. Enable Meta, Razorpay, or Stripe only after their credentials and HTTPS callback URLs are configured. Production contact-import and report-export files are private S3 objects; development uses the unserved `.private-storage/` directory.

## Frontend

The responsive React dashboard is isolated under `frontend/` and integrates through the documented HTTP APIs. Customer login is available at `/login`, platform-administrator login at `/admin/login`, and the Phase 1 team/security console at `/workspace`. Access tokens are short-lived, refresh tokens rotate, and logout/revocation invalidates the database session.

New customers register at `/register` and must verify their email before a session is issued. Team invitations are accepted at `/accept-invitation?token=...`. Password recovery starts at `/forgot-password`; reset links expire according to `PASSWORD_RESET_TTL_SECONDS` and successful resets revoke every active session. Development returns verification/reset tokens to the UI only when email delivery is not configured; production requires `APP_WEB_URL`, `MAIL_FROM`, `COMMUNICATION_API_URL`, and `COMMUNICATION_API_TOKEN` and delivers links through the retrying identity-email queue.

The **API operations** screen exposes the browser-callable Phase 1–4, system, upload, and platform-admin operations; provider-owned Meta and payment webhook receivers are intentionally not callable from the browser. Run it with `npm run ui:dev`; validate it with `npm run ui:test`, `npm run ui:build`, and `npm run ui:lint`.

## Developer platform (Phase 5)

The customer portal is available at `/developer`. Public server-to-server APIs use
`/public/v1` and require a scoped `wsa_live_…` or `wsa_test_…` Bearer credential.
Secrets are displayed once; only keyed verifiers are stored.

Required configuration:

- `API_KEY_HASH_SECRET`: at least 32 random characters, supplied by a secret manager.
- `META_CREDENTIAL_ENCRYPTION_KEY_BASE64`: exactly 32 random bytes encoded as base64;
  also encrypts recoverable developer-webhook signing secrets.
- `PUBLIC_API_KEY_RATE_PER_MINUTE`, `PUBLIC_API_ORG_RATE_PER_MINUTE`,
  `PUBLIC_API_SENDER_RATE_PER_MINUTE`, and `PUBLIC_API_DAILY_MESSAGE_LIMIT`.

Customer-authenticated OpenAPI 3.1 and Postman downloads are exposed at
`GET /api/v1/developer/openapi.json` and `GET /api/v1/developer/postman.json`.
Test credentials are isolated from Meta and mark every result as simulated. Live
messages require an existing contact with active consent, an approved template,
an authorized sender, an active plan, and remaining plan quota.
# whatsapp-saas
