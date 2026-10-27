# Phase 7 automation engine

Phase 7 extends the existing NestJS/TypeORM modular monolith and React/Vite UI. It deliberately reuses the current PostgreSQL tenant context, RBAC, BullMQ, Redis, WhatsApp messaging, inbox assignment, contacts, audit, encryption, and SSRF controls. No second ORM or frontend framework was introduced.

## Architecture

- PostgreSQL is the durable source of truth for workflow drafts, immutable versions, trigger events, executions, step attempts, and waits.
- BullMQ schedules execution and recovery work. A 30-second recovery scan resumes due waits and expired execution leases after restarts.
- Published versions are immutable snapshots. Active executions remain bound to their starting version.
- Each step has a stable operation ID. Database uniqueness and downstream messaging idempotency prevent duplicate side effects during at-least-once processing.
- Event payloads are AES-256-GCM encrypted. Only safe resource identifiers are retained in searchable JSON metadata.
- External HTTP actions require HTTPS, reject private/link-local/metadata destinations, disable redirects, use a 5-second timeout, and limit request and response bodies to 64 KiB.

## Safety limits

| Limit                                    |               Value |
| ---------------------------------------- | ------------------: |
| Nodes per workflow                       |                 100 |
| Edges per workflow                       |                 200 |
| Steps per execution                      |                 250 |
| Step attempts                            |                   3 |
| Concurrent running executions per tenant |                  20 |
| Executions per workflow per hour         |               1,000 |
| Wait duration                            | 1 second to 30 days |
| External HTTP timeout                    |           5 seconds |

Graph validation rejects cycles, unreachable nodes, invalid branches, unsafe expression paths, missing termination, and invalid action configuration. Conditions use a fixed operator set and never evaluate JavaScript.

## Permissions

- `automations.read`
- `automations.write`
- `automations.publish`
- `automations.execute`
- `automations.credentials.manage`

The migration grants these permissions to workspace owners/admins and platform super administrators. All workflow tables use tenant-scoped foreign keys, indexes, and forced PostgreSQL row-level security.

## API and UI

The backend exposes the Phase 7 routes under `/api/v1/workflows`, `/api/v1/workflow-executions`, `/api/v1/chatbot/rules`, and `/api/v1/automations`, plus the platform-admin automation routes. They are also listed in the UI API operations catalog.

Customer UI routes:

- `/automations`
- `/automations/workflows`
- `/automations/:id/builder`
- `/automations/chatbot`
- `/automations/executions`
- `/automations/analytics`
- `/automations/simulator`

Platform UI route: `/admin/automations`.

The builder includes keyboard-accessible zoom and pan controls in addition to drag-and-drop node positioning. The simulator validates and traces the graph without performing messaging or HTTP side effects. Production execution continues to enforce existing WhatsApp service-window, template, consent, entitlement, quota, sender, and assignment rules at execution time.

## Operations

Apply the schema in development PostgreSQL:

```sh
NODE_ENV=development npm run migration:run
```

Verification:

```sh
npm run build
npm run lint
npm test -- --runInBand
npm run ui:build
npm run ui:lint
npm run ui:test
```

Monitor failed BullMQ jobs, execution failure counts, recovery lag, active tenant concurrency, and emergency pauses. Expired automation events and executions have retention timestamps; physical retention deletion should remain part of the platform-wide retention job.

## Interactive messages

Inbox agents, chatbot rules, and workflow `SEND_INTERACTIVE` nodes can send WhatsApp reply buttons and lists through the existing encrypted, queued Meta delivery pipeline. Button messages support one to three unique replies. List messages support up to ten sections and ten total unique rows. The API validates Meta text limits before queueing, applies the same customer-service-window and quota controls as free-form replies, and never stores the interactive payload in plaintext.

Inbound button and list selections retain the configured reply ID for deterministic chatbot matching. They are not treated as marketing consent.
