# Phase 7 gap analysis and implementation plan

## Existing capabilities to reuse

- NestJS modular monolith, TypeORM/PostgreSQL migrations, tenant RLS, membership/RBAC guards, audit logging, Redis and BullMQ.
- Durable Meta webhook ingestion, encrypted inbound messages, shared inbox conversations, customer-service window timestamps, sender ownership, consent checks and the existing asynchronous WhatsApp send pipeline.
- Contact attributes/tags, agent assignment, developer webhook SSRF policy, authenticated field encryption, quotas and platform-admin diagnostics.
- React/Vite application and responsive component system. The repository does not use Prisma or Next.js; Phase 7 will extend TypeORM and React rather than add a second ORM/framework.

## Confirmed gaps

- No workflow definition, immutable version, trigger event, execution, step, wait-state, chatbot-rule, credential or automation-metric persistence.
- No graph validator, safe condition evaluator, durable workflow worker, delayed-step recovery, trigger deduplication or tenant concurrency controls.
- Existing inbound events do not yet publish a post-persistence automation event.
- No automation permissions, APIs, Super Admin monitoring or visual workflow UI.
- No React Flow dependency is installed. A small native draggable canvas is sufficient for the requested graph sizes and avoids introducing a dependency solely for Phase 7.

## Implementation plan

1. Add tenant-owned workflow drafts, immutable published versions, durable events/executions/steps/waits, chatbot rules and encrypted HTTP credentials with checks, indexes, composite foreign keys, retention and forced RLS.
2. Add a strict DAG validator and bounded safe condition evaluator; reject cycles, unreachable nodes, invalid branches, oversized graphs and unsafe action configuration.
3. Add APIs for lifecycle/versioning, chatbot rules, execution control, analytics, sandbox trace preview and credentials. Use optimistic workflow versions and audit all privileged changes.
4. Publish trigger events only after inbox/message persistence. Deduplicate events and create version-pinned executions for matching active workflows.
5. Execute one idempotent step at a time using PostgreSQL as source of truth and BullMQ for dispatch/delays. Reuse messaging, conversation and contact infrastructure; validate outbound HTTP destinations on every request.
6. Add seven responsive automation screens plus aggregate Super Admin health, update the API catalog, and run migration/build/lint/unit/runtime checks.

## Safety boundaries

- Workflow definitions never execute JavaScript. Conditions use allowlisted operators and bounded object paths.
- Production side effects are disabled in sandbox traces.
- Tenant and workflow IDs are always authorization-derived; published definitions are immutable.
- Message eligibility is rechecked at execution time and message operation IDs make queue retries idempotent.
- HTTP nodes require HTTPS/public DNS, revalidate the destination before execution, use bounded response sizes/timeouts and never expose decrypted credentials.
