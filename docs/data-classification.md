# Data classification and protection matrix

| Table / columns                              | Class                      | Protection                                                                                                               |
| -------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ISO reference tables, permission codes/names | PUBLIC/INTERNAL            | Plaintext, migration-controlled                                                                                          |
| Organization name, slug, settings/status     | CONFIDENTIAL               | TLS, encrypted storage, RLS, least privilege                                                                             |
| User ID, name, emails, phone, country        | PERSONAL_DATA              | TLS, encrypted storage, strict service access; phone/email plaintext only because indexed operational lookup is required |
| Password hash                                | AUTHENTICATION_DATA        | Argon2id verifier, excluded from default selects                                                                         |
| Token hashes                                 | AUTHENTICATION_DATA        | HMAC-SHA-256 verifier, excluded from default selects; secret token shown once                                            |
| Session IP/user agent                        | PERSONAL_DATA              | TLS, encrypted storage, bounded values, short retention                                                                  |
| MFA ciphertext/nonce/tag/key version         | RESTRICTED_SECRET          | AES-256-GCM, AAD, external versioned key, excluded from default selects                                                  |
| Membership, role assignments, invitations    | CONFIDENTIAL               | Tenant RLS and assignment constraints                                                                                    |
| Audit/security actor, IP, metadata           | PERSONAL_DATA/CONFIDENTIAL | RLS, append-only audit log, metadata size/type check                                                                     |
| User screen and billing journey events       | PERSONAL_DATA/CONFIDENTIAL | Tenant RLS, allowlisted event types, path-only capture, no query strings or page content                                 |
| Platform administrator assignments           | CONFIDENTIAL               | Separate global table, restrictive FK, audited bootstrap                                                                 |
| OIDC client secret ciphertext/nonce/tag       | RESTRICTED_SECRET          | AES-256-GCM with organization/connection AAD; plaintext never returned                                                    |
| Privacy request subject and history           | PERSONAL_DATA/CONFIDENTIAL | Tenant RLS, reauthentication, security-admin review and bounded reason fields                                             |
| Retention/deletion job records                | CONFIDENTIAL               | Tenant RLS; retain counts and error codes, not deleted payloads                                                           |
| Residency assignment and evidence reference   | CONFIDENTIAL               | Tenant read access, platform-controlled verification; assignment is not proof of residency                                |
| Security incidents and restore evidence       | CONFIDENTIAL               | Platform-admin isolation, bounded metadata and immutable event/evidence history                                           |

Never place passwords, raw tokens, decrypted MFA secrets, API keys, message bodies, or arbitrary request payloads in metadata. Database backups inherit the highest classification and must be encrypted with separately controlled keys.
