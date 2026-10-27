# Tenant isolation

1. The authenticated request resolves an authorized organization membership.
2. All tenant database work runs through `TenantContextService.run`.
3. The service opens a transaction and uses transaction-local `app.organization_id`.
4. PostgreSQL RLS filters and validates tenant-owned rows.
5. Role assignment triggers reject inactive, platform, or other-tenant roles.
6. Platform administration uses a separately authorized application path and should use a separate PostgreSQL login in production.

RLS is forced even for the table owner. The runtime database login must not have `BYPASSRLS` or superuser. Connection-pool code must never use session-persistent tenant settings; transaction-local settings prevent context leakage. Raw queries must remain inside the same tenant transaction.

Custom PostgreSQL settings alone are not authentication: SQL injection could set them. Production should give normal and platform-admin workers separate least-privilege database roles, revoke direct table access where practical, and expose narrowly scoped security-definer functions only after review.
