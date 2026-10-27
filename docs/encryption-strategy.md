# Encryption and hashing strategy

| Data                                             | Mechanism                                                     | Search/rotation                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password                                         | Argon2id, 64 MiB, 3 iterations, parallelism 1                 | Verify only; rehash on login when policy changes                                                                                                   |
| Sessions, invitations, verification/reset tokens | HMAC-SHA-256 with a >=32-byte secret pepper                   | Exact lookup by 64-char digest; rotate with dual-read/version migration if required                                                                |
| MFA recoverable secret                           | AES-256-GCM, random 96-bit nonce, 128-bit tag, contextual AAD | `key_version` selects KMS-managed data key; re-encrypt in bounded batches                                                                          |
| Email and phone                                  | Plaintext operational columns                                 | Storage encryption, TLS, RLS and access auditing; introduce ciphertext + HMAC blind index only if the threat model justifies loss of native lookup |

`FieldEncryptionService` accepts a key provider; production must bind it to envelope encryption backed by KMS/HSM. Keys and token peppers are not database columns, seed values, logs, or source configuration. Authentication failures must not reveal whether a digest matched.

Argon2 parameters require load testing on deployment hardware. Target roughly 100–250 ms per hash and cap concurrent password work to avoid memory exhaustion.
