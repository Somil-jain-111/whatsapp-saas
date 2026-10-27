# Index strategy

| Index                                                                   | Query supported                                |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `users(email_normalized)` unique                                        | Login and duplicate identity check             |
| `users(status, created_at DESC)`                                        | Operational user review                        |
| `organizations(slug)` unique                                            | Slug routing and creation conflict             |
| `roles(code)` partial global / `(organization_id, code)` partial tenant | Role resolution without cross-tenant ambiguity |
| `roles(organization_id, status)`                                        | Available tenant roles                         |
| `organization_members(organization_id, status)`                         | Tenant member listing                          |
| `organization_members(user_id, status)`                                 | User organization switcher                     |
| `invitations(organization_id, email_normalized)` partial pending        | One live invite per tenant/email               |
| `invitations(organization_id, status, expires_at)`                      | Invite administration and expiry job           |
| `sessions(token_hash)` unique                                           | Session authentication                         |
| `sessions(user_id, expires_at)` partial active                          | Active session list/revocation                 |
| Token expiry partial indexes                                            | Bounded cleanup jobs                           |
| `audit_logs(organization_id, created_at DESC, id DESC)`                 | Stable keyset audit pagination                 |
| `security_events` tenant/user/severity time indexes                     | Investigation timelines and alert review       |

Foreign-key indexes are present where PostgreSQL does not create them automatically and deletes/joins require them. No JSONB GIN index is added until real metadata query patterns exist.
