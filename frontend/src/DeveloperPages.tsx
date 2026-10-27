import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  api,
  ApiError,
  download,
  formatDate,
  formatNumber,
  listOf,
  readSession,
  text,
  type ApiRecord,
} from "./api";
import {
  DataState,
  Metric,
  Notice,
  PageHeader,
  SimpleTable,
  Status,
} from "./components";
import { useAction, useApi } from "./hooks";

const tabs = [
  ["Overview", "/developer"],
  ["API keys", "/developer/keys"],
  ["Documentation", "/developer/docs"],
  ["Playground", "/developer/playground"],
  ["Webhooks", "/developer/webhooks"],
  ["Usage", "/developer/usage"],
  ["Request logs", "/developer/logs"],
  ["Sandbox & SDKs", "/developer/sandbox"],
] as const;

const scopes = [
  "messages:send",
  "messages:read",
  "templates:read",
  "contacts:read",
  "contacts:write",
  "campaigns:read",
  "campaigns:manage",
  "reports:read",
  "webhooks:manage",
];

function DeveloperTabs() {
  return (
    <nav className="developer-tabs" aria-label="Developer portal">
      {tabs.map(([label, to]) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function DeveloperPage({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Developer platform"
        title={title}
        description={description}
        actions={actions}
      />
      <DeveloperTabs />
      {children}
    </>
  );
}

export function DeveloperOverviewPage() {
  const { data, loading, error } = useApi<ApiRecord>("/developer/overview");
  return (
    <DeveloperPage
      title="Developer overview"
      description="Production API health, credentials and integration quick start."
    >
      <DataState loading={loading} error={error}>
        <section className="metric-grid four">
          <Metric
            label="API status"
            value={data?.api_access_enabled ? "Enabled" : "Disabled"}
            tone={data?.api_access_enabled ? "green" : "amber"}
          />
          <Metric label="Active keys" value={formatNumber(data?.active_keys)} />
          <Metric
            label="Requests · 24h"
            value={formatNumber(data?.requests_24h)}
            tone="blue"
          />
          <Metric
            label="Error rate"
            value={`${text(data?.error_rate, "0")}%`}
            hint={`${formatNumber(data?.avg_latency_ms)} ms average`}
          />
        </section>
        <section className="card developer-quickstart">
          <h2>Quick start</h2>
          <ol>
            <li>Create a least-privilege test key.</li>
            <li>Try a deterministic sandbox request.</li>
            <li>Download OpenAPI or Postman assets.</li>
            <li>
              Create a live key only when your sender and consent records are
              ready.
            </li>
          </ol>
        </section>
      </DataState>
    </DeveloperPage>
  );
}

export function ApiKeysPage() {
  const keys = useApi<ApiRecord[]>("/developer/api-keys");
  const action = useAction();
  const [secret, setSecret] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [name, setName] = useState("Server integration");
  const [environment, setEnvironment] = useState<"TEST" | "LIVE">("TEST");
  const [selected, setSelected] = useState<string[]>([
    "messages:send",
    "messages:read",
    "templates:read",
  ]);
  const [expiresAt, setExpiresAt] = useState("");
  const [networks, setNetworks] = useState("");
  const [fingerprints, setFingerprints] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const created = await action.run(
      () =>
        api<ApiRecord>("/developer/api-keys", {
          method: "POST",
          body: JSON.stringify({
            name,
            environment,
            scopes: selected,
            ...(expiresAt
              ? { expiresAt: new Date(expiresAt).toISOString() }
              : {}),
            ipAllowlist: networks
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            mtlsFingerprints: fingerprints
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        }),
      "API key created. Copy its secrets now; they cannot be shown again.",
    );
    if (created) {
      setSecret(String(created.secret));
      setSigningSecret(String(created.signingSecret));
      await keys.refresh();
    }
  };
  const revoke = async (id: unknown) => {
    if (!confirm("Revoke this API key immediately?")) return;
    await action.run(
      () =>
        api(`/developer/api-keys/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason: "Revoked from developer portal" }),
        }),
      "API key revoked.",
    );
    await keys.refresh();
  };
  const rotate = async (id: unknown) => {
    const created = await action.run(
      () =>
        api<ApiRecord>(`/developer/api-keys/${id}/rotate`, {
          method: "POST",
          body: "{}",
        }),
      "Replacement created. The old key remains active until you revoke it.",
    );
    if (created) {
      setSecret(String(created.secret));
      setSigningSecret(String(created.signingSecret));
      await keys.refresh();
    }
  };
  return (
    <DeveloperPage
      title="API key management"
      description="Create scoped test or live credentials, rotate safely and revoke immediately."
    >
      {secret && (
        <Notice success>
          <strong>Copy these secrets now</strong>
          <span>API/OAuth client secret</span>
          <code className="secret-display">{secret}</code>
          <span>HMAC signing secret</span>
          <code className="secret-display">{signingSecret}</code>
          <button
            className="button secondary"
            onClick={() =>
              void navigator.clipboard.writeText(
                `API key: ${secret}\nSigning secret: ${signingSecret}`,
              )
            }
          >
            Copy both
          </button>
        </Notice>
      )}
      {action.error && <Notice>{action.error}</Notice>}
      <form className="card inline-form" onSubmit={submit}>
        <div className="card-heading">
          <h2>Create API key</h2>
          <button
            className="button primary"
            disabled={action.working || !selected.length}
          >
            Create key
          </button>
        </div>
        <div className="form-grid">
          <label>
            Name
            <input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Environment
            <select
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value as "TEST" | "LIVE")
              }
            >
              <option value="TEST">Sandbox</option>
              <option value="LIVE">Production</option>
            </select>
          </label>
          <label>
            Expires at (optional)
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <label>
            IP allowlist (optional)
            <input
              value={networks}
              onChange={(e) => setNetworks(e.target.value)}
              placeholder="203.0.113.8/32, 2001:db8::/48"
            />
          </label>
          <label>
            mTLS SHA-256 fingerprints (optional)
            <input
              value={fingerprints}
              onChange={(e) => setFingerprints(e.target.value)}
              placeholder="AA:BB:… (comma separated)"
            />
          </label>
        </div>
        <fieldset className="scope-grid">
          <legend>Permissions</legend>
          {scopes.map((scope) => (
            <label key={scope}>
              <input
                type="checkbox"
                checked={selected.includes(scope)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, scope]
                      : current.filter((item) => item !== scope),
                  )
                }
              />
              {scope}
            </label>
          ))}
        </fieldset>
      </form>
      <section className="card">
        <h2>Credentials</h2>
        <DataState
          loading={keys.loading}
          error={keys.error}
          empty={!keys.data?.length}
        >
          <SimpleTable
            rows={keys.data ?? []}
            columns={[
              { key: "name", label: "Name" },
              { key: "environment", label: "Environment" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "public_id",
                label: "Identifier",
                render: (row) => <code>{text(row.public_id)}</code>,
              },
              {
                key: "last_used_at",
                label: "Last used",
                render: (row) => formatDate(row.last_used_at),
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <span className="table-actions">
                    <button
                      className="button ghost"
                      onClick={() => void rotate(row.id)}
                    >
                      Rotate
                    </button>
                    {row.status === "ACTIVE" && (
                      <button
                        className="button danger"
                        onClick={() => void revoke(row.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </DataState>
      </section>
    </DeveloperPage>
  );
}

export function DeveloperDocumentationPage() {
  const samples = useApi<Record<string, string>>("/developer/code-samples");
  const [language, setLanguage] = useState("curl");
  return (
    <DeveloperPage
      title="API documentation"
      description="Authentication, stable v1 endpoints, errors, idempotency and code samples."
      actions={
        <>
          <button
            className="button secondary"
            onClick={() =>
              void download("/developer/openapi.json", "relay-openapi.json")
            }
          >
            OpenAPI 3.1
          </button>
          <button
            className="button primary"
            onClick={() =>
              void download("/developer/postman.json", "relay-postman.json")
            }
          >
            Postman
          </button>
        </>
      }
    >
      <section className="developer-docs">
        <aside className="card">
          <strong>Public API v1</strong>
          {[
            "Authentication",
            "Messages",
            "Templates",
            "Campaigns",
            "Reports",
            "Rate limits",
            "Errors",
            "Webhooks",
          ].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`}>
              {item}
            </a>
          ))}
        </aside>
        <article className="card">
          <h2 id="authentication">Server authentication</h2>
          <p>
            Use the API key directly as a Bearer credential, exchange it for a
            five-minute OAuth client-credentials token, or sign exact request
            bytes with HMAC-SHA256. Keys in query parameters are rejected. Keys
            configured for mTLS also require a CA-validated matching client
            certificate.
          </p>
          <h2 id="messages">Send a template message</h2>
          <div className="sample-toolbar">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {["curl", "oauth", "node", "python", "java", "php"].map(
                (item) => (
                  <option key={item}>{item}</option>
                ),
              )}
            </select>
            <button
              className="button ghost"
              onClick={() =>
                void navigator.clipboard.writeText(
                  samples.data?.[language] ?? "",
                )
              }
            >
              Copy
            </button>
          </div>
          <pre>{samples.data?.[language] ?? "Loading sample…"}</pre>
          <h2 id="rate-limits">Rate limits</h2>
          <p>
            Responses include limit, remaining and reset headers. Retry 429
            responses only after <code>Retry-After</code>.
          </p>
          <h2 id="errors">Errors and diagnostics</h2>
          <p>
            Keep the response request ID; it can be searched in Request logs.
          </p>
        </article>
      </section>
    </DeveloperPage>
  );
}

export function ApiPlaygroundPage() {
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"TEST" | "LIVE">("TEST");
  const [confirmed, setConfirmed] = useState(false);
  const [body, setBody] = useState(
    JSON.stringify(
      {
        to: "+919876543210",
        sender_id: "SENDER_UUID",
        template_id: "TEMPLATE_UUID",
        language: "en_US",
        parameters: {},
        scenario: "delivered",
      },
      null,
      2,
    ),
  );
  const [result, setResult] = useState<ApiRecord>({});
  const action = useAction();
  const execute = async () => {
    if (environment === "LIVE" && !confirmed) return;
    const started = performance.now();
    const origin = new URL(readSession()!.apiUrl).origin;
    await action.run(async () => {
      const response = await fetch(`${origin}/public/v1/messages/template`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body,
      });
      const payload = (await response.json()) as ApiRecord;
      setResult({
        status: response.status,
        latency: Math.round(performance.now() - started),
        requestId: response.headers.get("x-request-id"),
        response: payload,
      });
      if (!response.ok)
        throw new ApiError(
          String(payload.message ?? "Request failed"),
          response.status,
          payload,
        );
      return payload;
    }, "Request completed.");
  };
  return (
    <DeveloperPage
      title="API playground"
      description="Test public endpoints without storing your credential in the browser."
    >
      <Notice>
        The key remains only in this page's memory. Use a sandbox key unless you
        intentionally want to send a real message.
      </Notice>
      <section className="playground-grid">
        <div className="card">
          <div className="form-grid">
            <label>
              Environment
              <select
                value={environment}
                onChange={(e) =>
                  setEnvironment(e.target.value as "TEST" | "LIVE")
                }
              >
                <option value="TEST">Sandbox</option>
                <option value="LIVE">Production</option>
              </select>
            </label>
            <label>
              API key
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="wsa_test_…"
              />
            </label>
          </div>
          <label>
            Request body
            <textarea
              rows={16}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {environment === "LIVE" && (
            <label className="confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              I understand this sends a real WhatsApp message.
            </label>
          )}
          <button
            className="button primary"
            disabled={
              !apiKey ||
              action.working ||
              (environment === "LIVE" && !confirmed)
            }
            onClick={() => void execute()}
          >
            Execute request
          </button>
        </div>
        <div className="card">
          <h2>Response</h2>
          {action.error && <Notice>{action.error}</Notice>}
          <p>
            <strong>HTTP:</strong> {text(result.status)} ·{" "}
            <strong>Latency:</strong> {text(result.latency)} ms ·{" "}
            <strong>Request ID:</strong> {text(result.requestId)}
          </p>
          <pre>{JSON.stringify(result.response ?? {}, null, 2)}</pre>
        </div>
      </section>
    </DeveloperPage>
  );
}

export function WebhookManagementPage() {
  const endpoints = useApi<ApiRecord[]>("/developer/webhooks");
  const action = useAction();
  const [name, setName] = useState("Production events");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const deliveries = useApi<ApiRecord[]>(
    selectedEndpoint
      ? `/developer/webhooks/${selectedEndpoint}/deliveries`
      : null,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const created = await action.run(
      () =>
        api<ApiRecord>("/developer/webhooks", {
          method: "POST",
          body: JSON.stringify({
            name,
            url,
            events: ["message.accepted", "message.delivered", "message.failed"],
          }),
        }),
      "Webhook created.",
    );
    if (created) {
      setSecret(String(created.signingSecret));
      setUrl("");
      await endpoints.refresh();
    }
  };
  const test = async (id: unknown) => {
    await action.run(
      () =>
        api(`/developer/webhooks/${id}/test`, {
          method: "POST",
          body: JSON.stringify({ eventType: "message.accepted" }),
        }),
      "Test delivery queued.",
    );
  };
  const rotate = async (id: unknown) => {
    const result = await action.run(
      () =>
        api<ApiRecord>(`/developer/webhooks/${id}/rotate-secret`, {
          method: "POST",
        }),
      "Signing secret rotated.",
    );
    if (result) setSecret(String(result.signingSecret));
  };
  const replay = async (id: unknown) => {
    await action.run(
      () =>
        api(`/developer/webhooks/deliveries/${id}/replay`, { method: "POST" }),
      "Delivery replay queued.",
    );
    await deliveries.refresh();
  };
  return (
    <DeveloperPage
      title="Webhook management"
      description="Signed event delivery with retries, replay protection guidance and health tracking."
    >
      {secret && (
        <Notice success>
          Copy the signing secret now:{" "}
          <code className="secret-display">{secret}</code>
        </Notice>
      )}
      {action.error && <Notice>{action.error}</Notice>}
      <form className="card inline-form" onSubmit={submit}>
        <div className="card-heading">
          <h2>Add endpoint</h2>
          <button className="button primary" disabled={action.working}>
            Create endpoint
          </button>
        </div>
        <div className="form-grid">
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            HTTPS URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/relay"
              required
            />
          </label>
        </div>
      </form>
      <section className="card">
        <DataState
          loading={endpoints.loading}
          error={endpoints.error}
          empty={!endpoints.data?.length}
        >
          <SimpleTable
            rows={endpoints.data ?? []}
            columns={[
              { key: "name", label: "Endpoint" },
              { key: "url", label: "URL" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "consecutive_failures", label: "Failures" },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <span className="table-actions">
                    <button
                      className="button ghost"
                      onClick={() => void test(row.id)}
                    >
                      Test
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => void rotate(row.id)}
                    >
                      Rotate secret
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => setSelectedEndpoint(String(row.id))}
                    >
                      History
                    </button>
                  </span>
                ),
              },
            ]}
          />
        </DataState>
      </section>
      {selectedEndpoint && (
        <section className="card">
          <h2>Delivery history</h2>
          <DataState
            loading={deliveries.loading}
            error={deliveries.error}
            empty={!deliveries.data?.length}
          >
            <SimpleTable
              rows={deliveries.data ?? []}
              columns={[
                { key: "event_type", label: "Event" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                { key: "attempt_count", label: "Attempts" },
                { key: "response_status", label: "HTTP" },
                {
                  key: "created_at",
                  label: "Time",
                  render: (row) => formatDate(row.created_at),
                },
                {
                  key: "actions",
                  label: "",
                  render: (row) =>
                    ["FAILED", "DEAD"].includes(String(row.status)) ? (
                      <button
                        className="button ghost"
                        onClick={() => void replay(row.id)}
                      >
                        Replay
                      </button>
                    ) : null,
                },
              ]}
            />
          </DataState>
        </section>
      )}
    </DeveloperPage>
  );
}

export function ApiUsagePage() {
  const overview = useApi<ApiRecord>("/developer/overview");
  const spending = useApi<ApiRecord>("/developer/spending-cap");
  const action = useAction();
  const [cap, setCap] = useState("");
  const saveCap = async (event: FormEvent) => {
    event.preventDefault();
    await action.run(
      () =>
        api("/developer/spending-cap", {
          method: "PATCH",
          body: JSON.stringify({
            amountMinor: cap === "" ? null : Number(cap),
          }),
        }),
      cap === "" ? "Spending cap removed." : "Spending cap updated.",
    );
    await spending.refresh();
  };
  return (
    <DeveloperPage
      title="API usage & analytics"
      description="Request volume, errors, latency, rate-limit and quota health."
    >
      <DataState
        loading={overview.loading || spending.loading}
        error={overview.error || spending.error}
      >
        <section className="metric-grid four">
          <Metric
            label="Requests · 24h"
            value={formatNumber(overview.data?.requests_24h)}
            tone="blue"
          />
          <Metric
            label="Error rate"
            value={`${text(overview.data?.error_rate, "0")}%`}
          />
          <Metric
            label="Average latency"
            value={`${formatNumber(overview.data?.avg_latency_ms)} ms`}
          />
          <Metric
            label="Monthly API spend"
            value={`${formatNumber(spending.data?.spent_or_reserved_minor)} ${text(spending.data?.currency_code)}`}
            hint={
              spending.data?.api_monthly_spend_cap_minor === null
                ? "No customer cap"
                : `Cap ${formatNumber(spending.data?.api_monthly_spend_cap_minor)} minor units`
            }
          />
        </section>
        <form className="card inline-form" onSubmit={saveCap}>
          <div className="card-heading">
            <h2>Monthly messaging spending cap</h2>
            <button className="button primary" disabled={action.working}>
              Save cap
            </button>
          </div>
          <label>
            Amount in {text(spending.data?.currency_code)} minor units
            <input
              type="number"
              min="0"
              step="1"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              placeholder="Blank removes the cap"
            />
          </label>
          <p>
            This customer safety cap is checked transactionally before each live
            public API message. Plan quotas and Meta limits still apply
            independently.
          </p>
          {action.error && <Notice>{action.error}</Notice>}
        </form>
      </DataState>
    </DeveloperPage>
  );
}

export function RequestLogsPage() {
  const [requestId, setRequestId] = useState("");
  const path = useMemo(
    () =>
      `/developer/request-logs?limit=50${requestId ? `&requestId=${encodeURIComponent(requestId)}` : ""}`,
    [requestId],
  );
  const logs = useApi<ApiRecord>(path);
  const rows = listOf(logs.data);
  return (
    <DeveloperPage
      title="Request logs & diagnostics"
      description="Search safe metadata by request ID without exposing credentials or message content."
    >
      <section className="card">
        <label>
          Request ID
          <input
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            placeholder="UUID"
          />
        </label>
      </section>
      <section className="card">
        <DataState
          loading={logs.loading}
          error={logs.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              {
                key: "request_id",
                label: "Request ID",
                render: (row) => <code>{text(row.request_id)}</code>,
              },
              { key: "method", label: "Method" },
              { key: "endpoint", label: "Endpoint" },
              { key: "status_code", label: "HTTP" },
              {
                key: "latency_ms",
                label: "Latency",
                render: (row) => `${text(row.latency_ms)} ms`,
              },
              { key: "error_code", label: "Error" },
              {
                key: "created_at",
                label: "Time",
                render: (row) => formatDate(row.created_at),
              },
            ]}
          />
        </DataState>
      </section>
    </DeveloperPage>
  );
}

export function SandboxSdkPage() {
  return (
    <DeveloperPage
      title="Sandbox & SDK downloads"
      description="Deterministic scenarios and portable integration assets that never send to Meta."
      actions={
        <button
          className="button primary"
          onClick={() =>
            void download("/developer/postman.json", "relay-postman.json")
          }
        >
          Download Postman
        </button>
      }
    >
      <section className="metric-grid">
        <Metric label="delivered" value="Accepted → Delivered" tone="green" />
        <Metric label="read" value="Accepted → Read" tone="blue" />
        <Metric label="failed" value="Provider rejection" tone="amber" />
      </section>
      <section className="card">
        <h2>Sandbox rules</h2>
        <ul>
          <li>Create a TEST key on the API keys screen.</li>
          <li>
            Set <code>scenario</code> to delivered, read or failed.
          </li>
          <li>
            Every response is clearly marked <code>simulated: true</code>.
          </li>
          <li>
            Sandbox requests never invoke Meta or consume production message
            quota.
          </li>
        </ul>
        <div className="page-actions">
          <button
            className="button secondary"
            onClick={() =>
              void download("/developer/openapi.json", "relay-openapi.json")
            }
          >
            Download OpenAPI
          </button>
          <NavLink className="button primary" to="/developer/docs">
            Integration guides
          </NavLink>
        </div>
      </section>
    </DeveloperPage>
  );
}

export function AdminApiPlatformPage() {
  const overview = useApi<ApiRecord>("/internal/admin/v1/api/overview");
  const keys = useApi<ApiRecord[]>("/internal/admin/v1/api/keys");
  const events = useApi<ApiRecord[]>("/internal/admin/v1/api/security-events");
  const action = useAction();
  const revoke = async (id: unknown) => {
    if (!confirm("Emergency revoke this customer credential?")) return;
    await action.run(
      () =>
        api(`/internal/admin/v1/api/keys/${id}/emergency-revoke`, {
          method: "POST",
        }),
      "Credential revoked and security event recorded.",
    );
    await keys.refresh();
    await events.refresh();
  };
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Public API security"
        description="Global traffic, credential inventory, abuse signals and webhook health."
      />
      {action.error && <Notice>{action.error}</Notice>}
      <DataState loading={overview.loading} error={overview.error}>
        <section className="metric-grid four">
          <Metric
            label="Active keys"
            value={formatNumber(overview.data?.active_keys)}
          />
          <Metric
            label="Requests · 24h"
            value={formatNumber(overview.data?.requests_24h)}
            tone="blue"
          />
          <Metric
            label="Rate limits · 24h"
            value={formatNumber(overview.data?.rate_limits_24h)}
            tone="amber"
          />
          <Metric
            label="Security alerts · 24h"
            value={formatNumber(overview.data?.security_alerts_24h)}
          />
        </section>
      </DataState>
      <section className="card">
        <h2>Customer credential inventory</h2>
        <DataState
          loading={keys.loading}
          error={keys.error}
          empty={!keys.data?.length}
        >
          <SimpleTable
            rows={keys.data ?? []}
            columns={[
              { key: "organization_name", label: "Customer" },
              { key: "name", label: "Credential" },
              { key: "environment", label: "Environment" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "last_used_at",
                label: "Last used",
                render: (row) => formatDate(row.last_used_at),
              },
              {
                key: "actions",
                label: "",
                render: (row) =>
                  row.status === "ACTIVE" ? (
                    <button
                      className="button danger"
                      onClick={() => void revoke(row.id)}
                    >
                      Emergency revoke
                    </button>
                  ) : null,
              },
            ]}
          />
        </DataState>
      </section>
      <section className="card">
        <h2>Security events</h2>
        <DataState
          loading={events.loading}
          error={events.error}
          empty={!events.data?.length}
        >
          <SimpleTable
            rows={events.data ?? []}
            columns={[
              { key: "organization_name", label: "Customer" },
              { key: "event_type", label: "Event" },
              { key: "severity", label: "Severity" },
              { key: "source_ip", label: "Source IP" },
              {
                key: "created_at",
                label: "Time",
                render: (row) => formatDate(row.created_at),
              },
            ]}
          />
        </DataState>
      </section>
    </>
  );
}
