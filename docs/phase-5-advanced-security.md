# Phase 5 advanced API security

## OAuth 2.0 client credentials

Request a short-lived token with HTTP Basic authentication. Use the API key `public_id` as the client ID and the complete one-time `wsa_…` key as the client secret.

```http
POST /public/oauth/token
Authorization: Basic base64(public_id:api_key)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=messages%3Asend
```

The requested space-delimited scopes must be a subset of the key scopes. Access tokens expire after `PUBLIC_API_ACCESS_TOKEN_TTL_SECONDS` (300 seconds by default). Each public API request revalidates the underlying credential and tenant, so revocation and tenant suspension take effect immediately.

## HMAC proof of possession

API key creation and rotation return a separate signing secret once. Send:

- `X-Relay-Key-Id`: API key public identifier
- `X-Relay-Timestamp`: Unix time in seconds
- `X-Relay-Signature`: `v1=<lowercase HMAC-SHA256 hex>`

Canonical input:

```text
<timestamp>\n<UPPERCASE METHOD>\n<exact path and query>\n<SHA-256 hex of exact body bytes>
```

Requests outside the five-minute clock window or repeated signatures are rejected. Do not combine a Bearer header with HMAC headers; Bearer takes precedence.

## Mutual TLS

Add one or more SHA-256 client-certificate fingerprints when creating a key. The fingerprint is additive to the selected authentication method. Configure all three server values to terminate TLS in Nest:

- `TLS_CERT_PATH`
- `TLS_KEY_PATH`
- `MTLS_CA_PATH`

Only a certificate validated against that CA and matching the key fingerprint is accepted. If TLS terminates at an ingress, keep credential mTLS disabled until the ingress-to-application certificate identity is conveyed through an authenticated mechanism; ordinary forwarded certificate headers are not trusted.

## Monthly spending cap

`GET /api/v1/developer/spending-cap` returns the organization currency, cap, and current committed/reserved estimated messaging amount. `PATCH /api/v1/developer/spending-cap` accepts `amountMinor` as a non-negative integer or `null` to remove the customer cap.

The cap applies to live public API messages. Sandbox messages remain free and isolated. Subscription quotas, API throughput limits, and Meta limits remain independent and continue to apply.
