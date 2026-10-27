# Retention and deletion policy

These are configurable starting defaults, not legal conclusions.

| Data                      |               Starting retention | Deletion behavior                                                                        |
| ------------------------- | -------------------------------: | ---------------------------------------------------------------------------------------- |
| Active user profile       |                 Account lifetime | Rectify in place; anonymize after approved erasure workflow                              |
| Deleted user identifiers  |                          30 days | Anonymize email/name/phone after fraud/legal-hold check                                  |
| Organization              |      Contract lifetime + 30 days | Soft-delete workflow, then purge/anonymize tenant personal data                          |
| Sessions                  |                 Expiry + 30 days | Hard delete in bounded batches                                                           |
| Invitations               |                 Expiry + 90 days | Hard delete; retain audit event, not address, when possible                              |
| Verification/reset tokens | 30 days after expiry/consumption | Hard delete                                                                              |
| Security events           |                        12 months | Region/policy configurable; redact payload identifiers                                   |
| Audit logs                |                  7 years default | Append-only; legal basis and region may shorten/extend; anonymize actors where permitted |
| User journey events       |                          90 days | Hard delete in tenant-scoped batches; retain aggregated funnel counts when required      |
| MFA factors               |          Until revoked + 30 days | Destroy ciphertext and revoke key access                                                 |
| Backups                   | 35 days PITR + approved archives | Expire by backup lifecycle; erasure propagates on restore before service reopening       |
| Message content           |                          3 years | Null encrypted content fields in bounded batches; retain delivery metadata separately     |
| API request logs          |                           90 days | Hard delete in tenant-scoped batches                                                       |
| Security-event metadata   |                         365 days | Remove source IP and metadata; keep minimal event evidence                                 |

Legal holds override normal deletion and must be recorded outside mutable tenant data. Cleanup jobs use indexed expiry columns, keyset batches, bounded transactions, metrics and retry-safe deletes.

Only message content, API request logs and security-event metadata currently have automated executors. Other policy categories are tracking-only until a category-specific, tested erasure procedure exists.
