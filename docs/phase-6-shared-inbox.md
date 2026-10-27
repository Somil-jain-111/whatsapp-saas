# Phase 6 shared inbox

## Runtime

Phase 6 uses the existing NestJS application, PostgreSQL database, Redis connection, BullMQ send queue, encrypted Meta credentials and private object storage. Run the PostgreSQL migration before starting development:

```sh
NODE_ENV=development npm run migration:run
npm run start:dev
npm run ui:dev
```

No new environment variable is required. S3 remains optional; without it, media is stored under the process-private `.private-storage/` directory. Production deployments should use the configured private S3 bucket and a malware-scanning/quarantine process.

## API behavior

- Conversation, note, label, saved-reply, presence, analytics and settings endpoints live under `/api/v1/conversations` and `/api/v1/inbox`.
- Every endpoint derives the organization from the authenticated membership and requires an `inbox.*` permission. Client-supplied tenant IDs are ignored.
- Assignment and state changes use the conversation `version`; stale writes return `409 Conflict`.
- `POST /api/v1/conversations/:id/messages` is asynchronous. It persists and queues the request, then the existing Meta delivery pipeline updates the definitive status.
- Free-form text and media are accepted only inside the 24-hour service window. Outside the window, an approved template is required. Marketing templates also require current marketing consent.
- `POST /api/v1/conversations/:id/read` clears the shared unread count.
- `GET /api/v1/inbox/events` is an authenticated SSE feed. Resume with `Last-Event-ID` or `?cursor=`. Events remain replayable for seven days.

## Inbound processing

Meta webhook signatures are verified against the raw body before a sanitized event is durably stored. Message content is encrypted in the webhook record and again in the message row. Provider message IDs enforce deduplication. Tenant resolution uses the connected provider phone number, contacts created from inbound traffic are classified as `WHATSAPP_INBOUND`, and no marketing consent is inferred.

Inbound media is fetched from Meta only when an authorized agent downloads it. Host allowlisting, HTTPS, size limits, file-signature validation and private storage are enforced. A production malware scanner remains an infrastructure integration point.

## Real-time and presence

Database sequence IDs are the durable source of truth for real-time delivery, so reconnects and multiple application instances do not lose committed inbox changes. Redis presence is transient and expires after 75 seconds; durable availability preference is stored separately.

## Operational access

Super administrators can view tenant-level counts and webhook health at `/internal/admin/v1/inbox/health`. The endpoint never returns customer message bodies or credentials. Existing queue health and Meta diagnostic screens remain the source for backlog and integration investigation.
