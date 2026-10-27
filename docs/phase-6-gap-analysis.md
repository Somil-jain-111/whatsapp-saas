# Phase 6 gap analysis and implementation plan

## Existing capabilities to reuse

- NestJS modular monolith, TypeORM PostgreSQL migrations, forced tenant RLS, tenant-scoped repositories, membership/RBAC guards, audit logs, BullMQ and Redis.
- Verified Meta webhook receiver with raw-body HMAC verification, durable webhook deduplication, asynchronous processing and out-of-order outbound status protection.
- Existing `messages`, `message_status_events`, contacts, consent, sender, template, encrypted Meta credential and transactional quota/outbox infrastructure.
- Private S3/local object storage and AES-256-GCM field encryption.
- React/Vite frontend and shared responsive components. The repository does not use Next.js or Prisma, so Phase 6 will extend the existing stack rather than add a second framework or ORM.

## Confirmed gaps

- Webhook sanitization currently retains outbound delivery statuses and template events only; inbound message sender, content, type and media metadata are discarded.
- `messages` currently models outbound approved-template traffic only and cannot link messages to a conversation or store encrypted two-way content.
- No conversations, assignments, notes, labels, saved replies, durable activity feed, agent availability, inbox metrics or service-window enforcement.
- No WebSocket/SSE infrastructure. A database-cursor SSE feed is the smallest multi-instance-safe option: REST remains authoritative, durable events are committed with writes, and reconnecting clients recover from a sequence cursor without cross-tenant rooms or a new socket dependency.
- Existing private storage is suitable for media bytes but the inbox needs stricter MIME/signature/size checks and tenant-prefixed object keys.
- Super Admin has integration and queue health but no aggregate inbox health view.

## Implementation plan

1. Add tenant-owned conversation, assignment, note revision, label, saved reply, availability, activity, durable realtime and inbox settings tables; extend `messages` for direction/type/conversation/encrypted content/private media; add composite tenant foreign keys, indexes, checks, RLS and retention metadata.
2. Extend Meta webhook sanitization and processing for inbound messages. Resolve tenant by provider phone number, deduplicate by provider message ID, create an inbound-classified contact without marketing consent, create/reopen a conversation, persist encrypted content and activity/realtime events atomically, then publish only the committed cursor.
3. Add a conversations module with layered controllers/services/repository, optimistic concurrency for assignment/status updates, scoped notes/labels/saved replies, presence heartbeat, analytics and a cursor-based authenticated SSE feed.
4. Extend the existing messaging service/provider for text, template and validated private media replies. Enforce the 24-hour customer-service window from durable inbound timestamps; require an approved template outside the window and preserve existing sender, suppression, quota, encryption, queue and delivery-status paths.
5. Add the six responsive inbox screens and Super Admin aggregate diagnostics, then update API catalog/documentation.
6. Test webhook signature/deduplication/out-of-order behavior, conversation lifecycle, assignment concurrency, tenant isolation, service-window rules, private notes/labels, cursor recovery, media validation, build, lint and migrations.

## Safety boundaries

- Inbound contact creation records source `WHATSAPP_INBOUND` and never creates marketing consent.
- Conversation content is encrypted at rest; list/search uses contact metadata and non-content fields rather than plaintext message bodies.
- REST/SSE tenant identity always comes from the authenticated membership, never from client-supplied organization IDs.
- Platform administrators receive aggregate health only. No customer message body endpoint is added to the platform-admin surface.
