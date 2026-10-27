# Relay frontend

Responsive React dashboard for the WhatsApp SaaS backend.

## Run locally

```sh
cp .env.example .env.local
npm install
npm run dev
```

`VITE_API_URL` is deployment configuration, not a value users enter when signing in. It defaults to the same origin at `/api/v1`. During local development, Vite forwards `/api` and `/internal` to `VITE_API_PROXY_TARGET` (default `http://localhost:4002`), avoiding browser CORS configuration.

Customer and platform-admin logins store short-lived session credentials in session storage and send tenant-scoped API headers. The frontend does not import backend services or database models.

## Phase 2 screens

- `/integrations` and `/integrations/connect` — Meta connections and official Embedded Signup
- `/accounts` — synchronized WhatsApp Business Accounts and sender numbers
- `/templates` — template drafts, preview, submission, duplication, archive, and Meta sync
- `/integrations/diagnostics` — tenant integration health and provider failures
- `/admin/integrations` — platform-admin integration and template monitoring

Embedded Signup obtains its public App ID, configuration ID, and Graph API version from the backend. Meta secrets are never exposed to the frontend.

## Phase 3 screens

- `/contacts`, `/contacts/:id`, and `/contacts/audiences` — contact profiles, consent, tags, and segments
- `/contacts/imports/:id` — asynchronous import results and error reports
- `/messages`, `/messages/:id`, and `/messages/bulk` — template sending, status history, and bulk requests
- `/campaigns`, `/campaigns/new`, and `/campaigns/:id` — campaign building, validation, lifecycle controls, recipients, and metrics

## Phase 4 screens

- `/billing` and `/billing/invoices/:id` — plans, checkout, subscription lifecycle, invoices, and payments
- `/usage` — quota and usage metering
- `/analytics` and `/analytics/campaigns/:id` — message, template, campaign, and cost analytics
- `/reports` — asynchronous report generation, status, and downloads
- `/admin/billing` — platform billing, revenue, plan, usage, and adjustment operations

## Commands

- `npm run dev` — local development server
- `npm run build` — type-check and production build
- `npm run lint` — frontend lint
- `npm test` — frontend unit tests
