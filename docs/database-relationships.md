# Database relationships

```mermaid
erDiagram
  USER ||--o{ ORGANIZATION_MEMBER : joins
  ORGANIZATION ||--|{ ORGANIZATION_MEMBER : owns
  ROLE ||--o{ ORGANIZATION_MEMBER : assigned
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : included
  ORGANIZATION ||--o{ INVITATION : issues
  ROLE ||--o{ INVITATION : proposes
  USER ||--o{ SESSION : authenticates
  USER ||--o{ EMAIL_VERIFICATION : verifies
  USER ||--o{ PASSWORD_RESET : resets
  USER ||--o{ USER_MFA_FACTOR : secures
  USER ||--o| PLATFORM_ADMIN : elevates
  ORGANIZATION ||--o{ AUDIT_LOG : records
  ORGANIZATION ||--o{ SECURITY_EVENT : detects
  ISO_COUNTRY ||--o{ ORGANIZATION : locates
  ISO_CURRENCY ||--o{ ORGANIZATION : denominates
```

All tenant relations are constrained by `organization_id` plus assignment triggers where a nullable global role template prevents a simple composite foreign key. Deletion is restrictive for identity/history and cascading only for ephemeral credentials, tenant invitations, tenant custom roles, and role mappings.
