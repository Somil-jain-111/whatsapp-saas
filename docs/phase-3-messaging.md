# Phase 3 messaging, contacts, and campaigns

## Architecture

- All tenant data is stored in `whatsapp_core` with `organization_id`, composite tenant foreign keys, PostgreSQL RLS, and permission guards.
- Contact imports are accepted as bounded CSV/XLSX uploads, stored privately, and processed by the `contact-import` BullMQ worker in 500-row database batches. Imports never create marketing consent. Existing/suppressed contacts are not overwritten.
- Single and bulk template messages persist a durable message and outbox record before provider submission. `whatsapp-send` workers resolve encrypted Meta credentials server-side. Provider writes are never blindly retried; ambiguous outcomes become `UNKNOWN_SUBMISSION`.
- Campaign scheduling uses durable `campaign_schedules`, unique BullMQ job IDs, leases, and atomic state claims. A periodic queue recovery job handles missed enqueue operations and outbox events across replicas.
- Meta webhook events are signature-verified, allow-list sanitized, deduplicated, processed asynchronously, and reconciled monotonically so older events cannot replace delivered/read states.
- Backend entitlements atomically reserve and commit campaign and message-operation quota. Campaign pause/cancel prevents queued messages from being claimed; resume requeues unsent messages.

## Main APIs

- Contacts: `/api/v1/contacts`, `/contacts/import`, `/contacts/imports`, `/contacts/tags`, `/contacts/segments`, `/contacts/consents`
- Messaging: `POST /api/v1/messages/template`, `POST /api/v1/messages/bulk`, `GET /api/v1/messages`
- Campaigns: CRUD/list plus validate, launch, pause, resume, cancel, recipients, and metrics under `/api/v1/campaigns`
- Provider status webhook: `POST /webhooks/meta`

Every customer route requires a valid access session, active tenant membership, and the named RBAC permission. Recipient values in message logs are masked.

## Import format

Required columns: `full_name`, `country_code`, `phone_e164`. Optional: `email`. Files are limited to 10 MiB. Invalid and duplicate rows are recorded and an authenticated CSV error report is available from `/api/v1/contacts/imports/:id/errors`.

## Operations

Monitor queue depth and failures through `GET /internal/admin/v1/queues/health`. Failed and ambiguous provider submissions require operator reconciliation; automatically resending them could duplicate a WhatsApp message.
