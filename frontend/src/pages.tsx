import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  ContactRound,
  ExternalLink,
  FileUp,
  Link2,
  MessageCircleMore,
  Plus,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  Zap,
} from "lucide-react";
import {
  api,
  download,
  formatDate,
  formatNumber,
  listOf,
  number,
  readSession,
  saveSession,
  text,
  type ApiRecord,
  type WorkspaceSession,
} from "./api";
import {
  DataState,
  DateCell,
  Metric,
  Notice,
  PageHeader,
  SimpleTable,
  Status,
} from "./components";
import { useAction, useApi } from "./hooks";

function FormFeedback({ error, message }: { error: string; message: string }) {
  if (error) return <Notice>{error}</Notice>;
  if (message) return <Notice success>{message}</Notice>;
  return null;
}

export function ConnectPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<WorkspaceSession>(
    readSession() ?? {
      apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4002/api/v1",
      accessToken: "",
      organizationId: "",
    },
  );
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^https?:\/\//.test(form.apiUrl))
      return setError("Enter a valid API URL.");
    if (!form.accessToken.trim())
      return setError("An access token is required.");
    if (!/^[0-9a-f-]{36}$/i.test(form.organizationId))
      return setError("Enter a valid organization UUID.");
    saveSession({
      apiUrl: form.apiUrl.replace(/\/$/, ""),
      accessToken: form.accessToken.trim(),
      organizationId: form.organizationId.trim(),
    });
    navigate("/");
  };

  return (
    <main className="connect-page">
      <section className="connect-story">
        <div className="connect-brand">
          <span>
            <MessageCircleMore />
          </span>{" "}
          Relay
        </div>
        <div className="connect-copy">
          <p className="eyebrow light">WhatsApp operations, in one place</p>
          <h1>Turn conversations into measurable growth.</h1>
          <p>
            Connect your workspace to manage contacts, approved templates,
            campaigns, delivery analytics, and billing from one responsive
            console.
          </p>
          <div className="connect-points">
            <span>
              <ShieldCheck /> Tenant-safe access
            </span>
            <span>
              <Zap /> Durable campaign delivery
            </span>
            <span>
              <BarChart3 /> Live performance insight
            </span>
          </div>
        </div>
        <small>Enterprise-ready messaging operations</small>
      </section>
      <section className="connect-form-wrap">
        <form className="connect-form" onSubmit={submit}>
          <div className="mobile-connect-brand">
            <MessageCircleMore /> Relay
          </div>
          <p className="eyebrow">Workspace access</p>
          <h2>Connect your dashboard</h2>
          <p>
            Use a Phase 1 access token and organization ID. Credentials stay in
            this browser tab only.
          </p>
          <label>
            API URL
            <input
              value={form.apiUrl}
              onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
            />
          </label>
          <label>
            Organization ID
            <input
              value={form.organizationId}
              onChange={(e) =>
                setForm({ ...form, organizationId: e.target.value })
              }
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </label>
          <label>
            Access token
            <textarea
              rows={4}
              value={form.accessToken}
              onChange={(e) =>
                setForm({ ...form, accessToken: e.target.value })
              }
              placeholder="Paste bearer token"
            />
          </label>
          {error && <Notice>{error}</Notice>}
          <button className="button primary wide" type="submit">
            Open workspace <ArrowRight />
          </button>
          <small className="privacy-note">
            <ShieldCheck /> Stored in session storage and cleared when this tab
            closes.
          </small>
        </form>
      </section>
    </main>
  );
}

export function DashboardPage() {
  const analytics = useApi<ApiRecord>("/analytics/overview");
  const campaigns = useApi<unknown>("/campaigns?limit=5&page=1");
  const quotas = useApi<unknown>("/usage/quotas");
  const metrics = analytics.data ?? {};
  const campaignRows = listOf(campaigns.data);
  const quotaRows = listOf(quotas.data);
  const max = Math.max(number(metrics.total), 1);

  return (
    <>
      <PageHeader
        eyebrow="Good afternoon"
        title="Messaging overview"
        description="Monitor customer engagement, delivery health, and plan usage across your workspace."
        actions={
          <>
            <Link className="button secondary" to="/contacts">
              <FileUp /> Import contacts
            </Link>
            <Link className="button primary" to="/campaigns/new">
              <Send /> New campaign
            </Link>
          </>
        }
      />
      <section className="metric-grid four">
        <Metric
          label="Messages sent"
          value={formatNumber(metrics.sent)}
          hint={`${formatNumber(metrics.queued)} waiting`}
          tone="blue"
        />
        <Metric
          label="Delivered"
          value={formatNumber(metrics.delivered)}
          hint={`${text(metrics.delivery_rate, "0")}% delivery rate`}
          tone="green"
        />
        <Metric
          label="Read"
          value={formatNumber(metrics.read)}
          hint={`${text(metrics.read_rate, "0")}% read rate`}
        />
        <Metric
          label="Failed"
          value={formatNumber(metrics.failed)}
          hint={`${text(metrics.failure_rate, "0")}% failure rate`}
          tone="amber"
        />
      </section>

      <section className="dashboard-grid">
        <article className="card delivery-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Last 30 days</p>
              <h2>Delivery performance</h2>
            </div>
            <span className="live-dot">Live</span>
          </div>
          <DataState loading={analytics.loading} error={analytics.error}>
            <div className="delivery-bars">
              {[
                { label: "Sent", value: metrics.sent, tone: "blue" },
                { label: "Delivered", value: metrics.delivered, tone: "green" },
                { label: "Read", value: metrics.read, tone: "purple" },
                { label: "Failed", value: metrics.failed, tone: "amber" },
              ].map(({ label, value, tone }) => (
                <div className="bar-row" key={String(label)}>
                  <span>{label}</span>
                  <div>
                    <i
                      className={`bar-${tone}`}
                      style={{
                        width: `${Math.max((number(value) / max) * 100, number(value) ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                  <strong>{formatNumber(value)}</strong>
                </div>
              ))}
            </div>
          </DataState>
          <div className="mini-summary">
            <div>
              <strong>{formatNumber(metrics.total)}</strong>
              <span>Total messages</span>
            </div>
            <div>
              <strong>{text(metrics.delivery_rate, "0")}%</strong>
              <span>Delivery rate</span>
            </div>
            <div>
              <strong>{text(metrics.read_rate, "0")}%</strong>
              <span>Read rate</span>
            </div>
          </div>
        </article>

        <article className="card quota-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Current period</p>
              <h2>Plan usage</h2>
            </div>
            <WalletCards />
          </div>
          <DataState
            loading={quotas.loading}
            error={quotas.error}
            empty={!quotaRows.length}
          >
            <div className="quota-list">
              {quotaRows.slice(0, 4).map((row) => {
                const percent = number(row.quota)
                  ? Math.min((number(row.used) / number(row.quota)) * 100, 100)
                  : 0;
                return (
                  <div key={text(row.code)}>
                    <div>
                      <span>{text(row.code).replaceAll("_", " ")}</span>
                      <strong>
                        {formatNumber(row.used)} / {formatNumber(row.quota)}
                      </strong>
                    </div>
                    <progress max="100" value={percent} />
                  </div>
                );
              })}
            </div>
          </DataState>
          <a className="text-link" href="/billing">
            View billing & usage <ArrowRight />
          </a>
        </article>
      </section>

      <article className="card table-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Campaign activity</p>
            <h2>Recent campaigns</h2>
          </div>
          <a className="text-link" href="/campaigns">
            View all <ArrowRight />
          </a>
        </div>
        <DataState
          loading={campaigns.loading}
          error={campaigns.error}
          empty={!campaignRows.length}
        >
          <SimpleTable
            rows={campaignRows}
            columns={[
              { key: "name", label: "Campaign" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "recipient_count",
                label: "Recipients",
                render: (row) => formatNumber(row.recipient_count),
              },
              {
                key: "scheduled_at",
                label: "Scheduled",
                render: (row) => (
                  <DateCell value={row.scheduled_at ?? row.created_at} />
                ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function ContactsPage() {
  const contacts = useApi<unknown>("/contacts?limit=50&page=1");
  const imports = useApi<unknown>("/contacts/imports");
  const action = useAction();
  const rows = listOf(contacts.data);
  const [showCreate, setShowCreate] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await action.run(
      () => api("/contacts", { method: "POST", body: JSON.stringify(values) }),
      "Contact created.",
    );
    if (result) {
      event.currentTarget.reset();
      setShowCreate(false);
      void contacts.refresh();
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const result = await action.run(
      () => api("/contacts/import", { method: "POST", body }),
      "Import queued for processing.",
    );
    if (result) void imports.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Audience"
        title="Contacts"
        description="Manage people, consent, tags, segments, and bulk imports safely."
        actions={
          <>
            <label className="button secondary file-button">
              <FileUp /> Import CSV/XLSX
              <input type="file" accept=".csv,.xlsx" onChange={upload} />
            </label>
            <button
              className="button primary"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus /> Add contact
            </button>
          </>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      {showCreate && (
        <article className="card inline-form">
          <div className="card-heading">
            <h2>Add contact</h2>
          </div>
          <form onSubmit={create} className="form-grid">
            <label>
              Full name
              <input name="fullName" required maxLength={150} />
            </label>
            <label>
              Country code
              <input
                name="countryCode"
                required
                placeholder="IN"
                pattern="[A-Z]{2}"
              />
            </label>
            <label>
              Phone (E.164)
              <input name="phoneE164" required placeholder="+919876543210" />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <div className="form-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={action.working}>
                Save contact
              </button>
            </div>
          </form>
        </article>
      )}
      <section className="summary-strip">
        <div>
          <ContactRound />
          <span>
            <strong>
              {formatNumber((contacts.data as ApiRecord)?.total ?? rows.length)}
            </strong>
            Total contacts
          </span>
        </div>
        <div>
          <UsersRound />
          <span>
            <strong>{formatNumber(listOf(imports.data).length)}</strong>Recent
            imports
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>Explicit</strong>Consent policy
          </span>
        </div>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>All contacts</h2>
          </div>
          <input className="small-input" placeholder="Search contacts" />
        </div>
        <DataState
          loading={contacts.loading}
          error={contacts.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "full_name", label: "Contact" },
              { key: "phone_e164", label: "Phone" },
              { key: "email", label: "Email" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "created_at",
                label: "Added",
                render: (row) => <DateCell value={row.created_at} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function MessagesPage() {
  const messages = useApi<unknown>("/messages?limit=100&page=1");
  const action = useAction();
  const rows = listOf(messages.data);
  const [composer, setComposer] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    const payload = {
      ...values,
      parameters: {},
      idempotencyKey: crypto.randomUUID(),
    };
    const result = await action.run(
      () =>
        api("/messages/template", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      "Message accepted for delivery.",
    );
    if (result) {
      setComposer(false);
      void messages.refresh();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Messaging"
        title="Message log"
        description="Track every accepted, sent, delivered, read, and failed message."
        actions={
          <button
            className="button primary"
            onClick={() => setComposer((v) => !v)}
          >
            <MessageCircleMore /> Send message
          </button>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      {composer && (
        <article className="card inline-form">
          <h2>Send approved template</h2>
          <form className="form-grid" onSubmit={sendMessage}>
            <label>
              Recipient phone
              <input
                name="recipientPhone"
                required
                placeholder="+919876543210"
              />
            </label>
            <label>
              Sender ID
              <input name="senderId" required />
            </label>
            <label>
              Template ID
              <input name="templateId" required />
            </label>
            <label>
              Language
              <input name="language" defaultValue="en" required />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setComposer(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={action.working}>
                Queue message
              </button>
            </div>
          </form>
        </article>
      )}
      <section className="metric-grid four">
        <Metric
          label="Total"
          value={formatNumber(
            (messages.data as ApiRecord)?.total ?? rows.length,
          )}
          tone="blue"
        />
        <Metric
          label="Delivered"
          value={formatNumber(
            rows.filter((r) => ["DELIVERED", "READ"].includes(text(r.status)))
              .length,
          )}
          tone="green"
        />
        <Metric
          label="Read"
          value={formatNumber(
            rows.filter((r) => text(r.status) === "READ").length,
          )}
        />
        <Metric
          label="Failed"
          value={formatNumber(
            rows.filter((r) => text(r.status) === "FAILED").length,
          )}
          tone="amber"
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Delivery events</h2>
          <button
            className="button ghost"
            onClick={() => void messages.refresh()}
          >
            <RefreshCw /> Refresh
          </button>
        </div>
        <DataState
          loading={messages.loading}
          error={messages.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "recipient_phone", label: "Recipient" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "template_name", label: "Template" },
              { key: "error_code", label: "Provider result" },
              {
                key: "created_at",
                label: "Created",
                render: (row) => <DateCell value={row.created_at} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function CampaignsPage() {
  const campaigns = useApi<unknown>("/campaigns?limit=100&page=1");
  const action = useAction();
  const rows = listOf(campaigns.data);

  async function transition(id: unknown, operation: string) {
    const result = await action.run(
      () => api(`/campaigns/${id}/${operation}`, { method: "POST" }),
      `Campaign ${operation} request accepted.`,
    );
    if (result) void campaigns.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Engagement"
        title="Campaigns"
        description="Prepare, validate, schedule, and monitor bulk WhatsApp campaigns."
        actions={
          <button className="button primary">
            <Plus /> New campaign
          </button>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      <section className="metric-grid four">
        <Metric
          label="All campaigns"
          value={formatNumber(
            (campaigns.data as ApiRecord)?.total ?? rows.length,
          )}
          tone="blue"
        />
        <Metric
          label="Running"
          value={formatNumber(
            rows.filter((r) => ["RUNNING", "QUEUED"].includes(text(r.status)))
              .length,
          )}
          tone="green"
        />
        <Metric
          label="Scheduled"
          value={formatNumber(
            rows.filter((r) => text(r.status) === "SCHEDULED").length,
          )}
        />
        <Metric
          label="Drafts"
          value={formatNumber(
            rows.filter((r) => text(r.status) === "DRAFT").length,
          )}
          tone="amber"
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Campaign manager</p>
            <h2>All campaigns</h2>
          </div>
          <select className="small-input">
            <option>All statuses</option>
            <option>Draft</option>
            <option>Scheduled</option>
            <option>Running</option>
          </select>
        </div>
        <DataState
          loading={campaigns.loading}
          error={campaigns.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "name", label: "Campaign" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "recipient_count",
                label: "Audience",
                render: (row) => formatNumber(row.recipient_count),
              },
              {
                key: "scheduled_at",
                label: "Schedule",
                render: (row) => <DateCell value={row.scheduled_at} />,
              },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <div className="row-actions">
                    <button onClick={() => void transition(row.id, "validate")}>
                      Validate
                    </button>
                    {text(row.status) === "PAUSED" ? (
                      <button onClick={() => void transition(row.id, "resume")}>
                        Resume
                      </button>
                    ) : (
                      <button onClick={() => void transition(row.id, "pause")}>
                        Pause
                      </button>
                    )}
                    <button onClick={() => void transition(row.id, "launch")}>
                      Launch
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function IntegrationsPage() {
  const [selectedId, setSelectedId] = useState("");
  const connections = useApi<unknown>("/meta/connections");
  const connection = useApi<ApiRecord>(
    selectedId ? `/meta/connections/${selectedId}` : null,
  );
  const accounts = useApi<unknown>("/whatsapp/accounts");
  const health = useApi<ApiRecord>("/integrations/health");
  const errors = useApi<unknown>("/integrations/errors");
  const action = useAction();
  const connectionRows = listOf(connections.data);
  const accountRows = listOf(accounts.data);

  async function sync(id: unknown) {
    const result = await action.run(
      () => api(`/meta/connections/${id}/sync`, { method: "POST" }),
      "Account synchronization queued.",
    );
    if (result) {
      void connections.refresh();
      void accounts.refresh();
      if (selectedId === id) void connection.refresh();
    }
  }

  async function disconnect(id: unknown) {
    const reason = window
      .prompt(
        "Why are you disconnecting this Meta business? (at least 3 characters)",
      )
      ?.trim();
    if (!reason || reason.length < 3) return;
    const result = await action.run(async () => {
      await api(`/meta/connections/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      return true;
    }, "Meta connection disconnected.");
    if (result) {
      void connections.refresh();
      void accounts.refresh();
      if (selectedId === id) setSelectedId("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Meta platform"
        title="WhatsApp connections"
        description="Connect authorized business accounts, senders, and webhook subscriptions."
        actions={
          <>
            <Link className="button secondary" to="/integrations/diagnostics">
              Diagnostics
            </Link>
            <Link className="button primary" to="/integrations/connect">
              <Link2 /> Connect WhatsApp
            </Link>
          </>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      <section className="integration-hero card">
        <div className="integration-icon">
          <MessageCircleMore />
        </div>
        <div>
          <p className="eyebrow">Connection health</p>
          <h2>
            {text(
              health.data?.status,
              connectionRows.length ? "Connected" : "Not connected",
            )}
          </h2>
          <p>
            {connectionRows.length
              ? `${connectionRows.length} Meta connection${connectionRows.length === 1 ? "" : "s"} authorized for this workspace.`
              : "Connect a Meta Business Account to start syncing templates and phone numbers."}
          </p>
        </div>
        <Status
          value={
            health.data?.status ??
            (connectionRows.length ? "active" : "inactive")
          }
        />
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Meta connections</h2>
          </div>
          <DataState
            loading={connections.loading}
            error={connections.error}
            empty={!connectionRows.length}
          >
            <div className="stack-list">
              {connectionRows.map((row) => (
                <div className="stack-item" key={text(row.id)}>
                  <span className="item-icon">
                    <Link2 />
                  </span>
                  <div>
                    <strong>
                      {text(
                        row.businessName ?? row.business_name ?? row.name,
                        "Meta business",
                      )}
                    </strong>
                    <small>
                      {text(
                        row.providerBusinessId ??
                          row.provider_business_id ??
                          row.meta_business_id,
                      )}
                    </small>
                  </div>
                  <Status value={row.status} />
                  <div className="row-actions">
                    <button onClick={() => setSelectedId(text(row.id, ""))}>
                      View
                    </button>
                    <button
                      onClick={() => void sync(row.id)}
                      aria-label="Synchronize"
                    >
                      <RefreshCw />
                    </button>
                    <button
                      onClick={() => void disconnect(row.id)}
                      aria-label="Disconnect"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>WhatsApp accounts</h2>
            <Link className="row-link" to="/accounts">
              Manage all
            </Link>
          </div>
          <DataState
            loading={accounts.loading}
            error={accounts.error}
            empty={!accountRows.length}
          >
            <div className="stack-list">
              {accountRows.map((row) => (
                <Link
                  className="stack-item"
                  key={text(row.id)}
                  to={`/accounts/${row.id}`}
                >
                  <span className="item-icon green">
                    <MessageCircleMore />
                  </span>
                  <div>
                    <strong>
                      {text(
                        row.businessName ?? row.name ?? row.business_name,
                        "WhatsApp account",
                      )}
                    </strong>
                    <small>
                      {text(
                        row.providerAccountId ??
                          row.provider_account_id ??
                          row.waba_id,
                      )}
                    </small>
                  </div>
                  <Status value={row.status} />
                </Link>
              ))}
            </div>
          </DataState>
        </article>
      </section>
      {selectedId && (
        <article className="card detail-list">
          <div>
            <span>Connection ID</span>
            <strong>{text(connection.data?.id)}</strong>
          </div>
          <div>
            <span>Provider business</span>
            <strong>{text(connection.data?.providerBusinessId)}</strong>
          </div>
          <div>
            <span>Status</span>
            <Status value={connection.data?.status} />
          </div>
          <div>
            <span>Last synchronized</span>
            <strong>{formatDate(connection.data?.lastSyncedAt)}</strong>
          </div>
          <div>
            <span>Credential expiry</span>
            <strong>{formatDate(connection.data?.tokenExpiresAt)}</strong>
          </div>
          {connection.error && <Notice>{connection.error}</Notice>}
        </article>
      )}
      <article className="card table-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Diagnostics</p>
            <h2>Recent integration errors</h2>
          </div>
        </div>
        <DataState
          loading={errors.loading}
          error={errors.error}
          empty={!listOf(errors.data).length}
        >
          <SimpleTable
            rows={listOf(errors.data)}
            columns={[
              { key: "code", label: "Code" },
              { key: "message", label: "Safe message" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "created_at",
                label: "Time",
                render: (row) => <DateCell value={row.created_at} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function TemplatesPage() {
  const templates = useApi<unknown>("/templates?limit=100");
  const action = useAction();
  const rows = listOf(templates.data);

  async function sync() {
    const result = await action.run(
      () => api("/templates/sync", { method: "POST" }),
      "Template synchronization queued.",
    );
    if (result) void templates.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Message templates"
        description="Manage local drafts and Meta approval status across languages and categories."
        actions={
          <>
            <button className="button secondary" onClick={() => void sync()}>
              <RefreshCw /> Sync Meta
            </button>
            <Link className="button primary" to="/templates/new">
              <Plus /> New template
            </Link>
          </>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      <section className="summary-strip">
        <div>
          <Sparkles />
          <span>
            <strong>{rows.length}</strong>Total templates
          </span>
        </div>
        <div>
          <Check />
          <span>
            <strong>
              {
                rows.filter(
                  (r) => text(r.metaStatus ?? r.meta_status) === "APPROVED",
                ).length
              }
            </strong>
            Approved
          </span>
        </div>
        <div>
          <RefreshCw />
          <span>
            <strong>
              {
                rows.filter((r) =>
                  ["PENDING", "IN_REVIEW"].includes(
                    text(r.metaStatus ?? r.meta_status),
                  ),
                ).length
              }
            </strong>
            In review
          </span>
        </div>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Template library</h2>
          <input className="small-input" placeholder="Search templates" />
        </div>
        <DataState
          loading={templates.loading}
          error={templates.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              {
                key: "name",
                label: "Template",
                render: (row) => (
                  <Link className="row-link" to={`/templates/${row.id}`}>
                    {text(row.name)}
                  </Link>
                ),
              },
              { key: "category", label: "Category" },
              { key: "language", label: "Language" },
              {
                key: "metaStatus",
                label: "Meta status",
                render: (row) => (
                  <Status
                    value={
                      row.metaStatus ??
                      row.meta_status ??
                      row.localStatus ??
                      row.status
                    }
                  />
                ),
              },
              {
                key: "updatedAt",
                label: "Updated",
                render: (row) => (
                  <DateCell
                    value={
                      row.updatedAt ??
                      row.updated_at ??
                      row.createdAt ??
                      row.created_at
                    }
                  />
                ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function AnalyticsPage() {
  const overview = useApi<ApiRecord>("/analytics/overview");
  const campaigns = useApi<unknown>("/analytics/campaigns");
  const templates = useApi<unknown>("/analytics/templates");
  const costs = useApi<unknown>("/analytics/costs");
  const data = overview.data ?? {};
  const campaignRows = listOf(campaigns.data);
  const templateRows = listOf(templates.data);
  const costRows = listOf(costs.data);
  const totalCost = costRows.reduce(
    (sum, row) => sum + number(row.amount_minor),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="Understand campaign delivery, template performance, and estimated messaging costs."
        actions={
          <select className="button secondary">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>This quarter</option>
          </select>
        }
      />
      <section className="metric-grid four">
        <Metric
          label="Accepted"
          value={formatNumber(data.accepted)}
          tone="blue"
        />
        <Metric
          label="Delivery rate"
          value={`${text(data.delivery_rate, "0")}%`}
          tone="green"
        />
        <Metric label="Read rate" value={`${text(data.read_rate, "0")}%`} />
        <Metric
          label="Estimated cost"
          value={`${text(costRows[0]?.currency, "")} ${(totalCost / 100).toFixed(2)}`}
          tone="amber"
        />
      </section>
      <section className="two-column analytics-panels">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Campaign performance</h2>
          </div>
          <DataState
            loading={campaigns.loading}
            error={campaigns.error}
            empty={!campaignRows.length}
          >
            <SimpleTable
              rows={campaignRows.slice(0, 8)}
              columns={[
                { key: "name", label: "Campaign" },
                {
                  key: "delivered",
                  label: "Delivered",
                  render: (row) => formatNumber(row.delivered),
                },
                {
                  key: "read",
                  label: "Read",
                  render: (row) => formatNumber(row.read),
                },
                {
                  key: "failed",
                  label: "Failed",
                  render: (row) => formatNumber(row.failed),
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Top templates</h2>
          </div>
          <DataState
            loading={templates.loading}
            error={templates.error}
            empty={!templateRows.length}
          >
            <SimpleTable
              rows={templateRows.slice(0, 8)}
              columns={[
                { key: "name", label: "Template" },
                {
                  key: "usage_count",
                  label: "Uses",
                  render: (row) => formatNumber(row.usage_count),
                },
                {
                  key: "delivered",
                  label: "Delivered",
                  render: (row) => formatNumber(row.delivered),
                },
                {
                  key: "read",
                  label: "Read",
                  render: (row) => formatNumber(row.read),
                },
              ]}
            />
          </DataState>
        </article>
      </section>
    </>
  );
}

export function ReportsPage() {
  const reports = useApi<unknown>("/reports/exports");
  const action = useAction();
  const rows = listOf(reports.data);
  const [type, setType] = useState("CAMPAIGN");
  const [format, setFormat] = useState("CSV");

  async function create() {
    const result = await action.run(
      () =>
        api("/reports/exports", {
          method: "POST",
          body: JSON.stringify({ type, format, filters: {} }),
        }),
      "Report queued. Refresh shortly to download it.",
    );
    if (result) void reports.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Exports"
        title="Reports"
        description="Generate tenant-scoped CSV, Excel, and PDF exports asynchronously."
        actions={
          <button
            className="button secondary"
            onClick={() => void reports.refresh()}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      <article className="card report-builder">
        <div>
          <span className="report-icon">
            <FileUp />
          </span>
          <div>
            <p className="eyebrow">New export</p>
            <h2>Build a report</h2>
            <p>Files remain private and expire automatically.</p>
          </div>
        </div>
        <label>
          Report type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>CAMPAIGN</option>
            <option>MESSAGES</option>
            <option>TEMPLATES</option>
            <option>USAGE</option>
            <option>BILLING</option>
            <option>PAYMENTS</option>
          </select>
        </label>
        <label>
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option>CSV</option>
            <option>XLSX</option>
            <option>PDF</option>
          </select>
        </label>
        <button
          className="button primary"
          onClick={() => void create()}
          disabled={action.working}
        >
          <Rocket /> Generate
        </button>
      </article>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Export history</h2>
        </div>
        <DataState
          loading={reports.loading}
          error={reports.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "type", label: "Report" },
              { key: "format", label: "Format" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "created_at",
                label: "Requested",
                render: (row) => <DateCell value={row.created_at} />,
              },
              {
                key: "expires_at",
                label: "Expires",
                render: (row) => <DateCell value={row.expires_at} />,
              },
              {
                key: "download",
                label: "",
                render: (row) =>
                  text(row.status) === "COMPLETED" ? (
                    <button
                      className="row-link"
                      onClick={() =>
                        void download(
                          `/reports/exports/${row.id}/download`,
                          `report-${row.id}.${text(row.format).toLowerCase()}`,
                        )
                      }
                    >
                      <ArrowDownToLine /> Download
                    </button>
                  ) : null,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function BillingPage() {
  const plans = useApi<unknown>("/billing/plans");
  const subscription = useApi<ApiRecord>("/billing/subscription");
  const invoices = useApi<unknown>("/billing/invoices");
  const payments = useApi<unknown>("/billing/payments");
  const quotas = useApi<unknown>("/usage/quotas");
  const action = useAction();
  const planRows = listOf(plans.data);
  const invoiceRows = listOf(invoices.data);
  const quotaRows = listOf(quotas.data);

  async function portal() {
    const result = await action.run(
      () =>
        api<ApiRecord>("/billing/portal-session", {
          method: "POST",
          body: "{}",
        }),
      "Billing portal created.",
    );
    const url = result && (result.url ?? result.portalUrl);
    if (url) window.location.assign(String(url));
  }

  return (
    <>
      <PageHeader
        eyebrow="Subscription"
        title="Billing & usage"
        description="Manage your plan, hosted payments, invoices, and workspace quotas."
        actions={
          <button className="button secondary" onClick={() => void portal()}>
            <ExternalLink /> Billing portal
          </button>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      <section className="billing-overview">
        <article className="card current-plan">
          <div>
            <p className="eyebrow">Current plan</p>
            <h2>{text(subscription.data?.plan_name, "No active plan")}</h2>
            <p>{text(subscription.data?.status, "Choose a plan to begin")}</p>
          </div>
          <div className="plan-price">
            <strong>
              {subscription.data
                ? `${text(subscription.data.currency)} ${(number(subscription.data.amount_minor) / 100).toFixed(2)}`
                : "—"}
            </strong>
            <span>
              {subscription.data
                ? `/ ${text(subscription.data.interval).toLowerCase()}`
                : ""}
            </span>
          </div>
          <Status value={subscription.data?.status ?? "inactive"} />
        </article>
        <article className="card renewal-card">
          <CircleDollarSign />
          <div>
            <p className="eyebrow">Next renewal</p>
            <strong>{formatDate(subscription.data?.current_period_end)}</strong>
            <span>Provider webhook is authoritative</span>
          </div>
        </article>
      </section>
      <section className="plan-grid">
        {planRows.slice(0, 3).map((plan) => (
          <article className="card plan-card" key={text(plan.id)}>
            <div>
              <p className="eyebrow">{text(plan.code)}</p>
              <h2>{text(plan.name)}</h2>
              <p>
                {text(
                  plan.description,
                  "Everything you need to message customers confidently.",
                )}
              </p>
            </div>
            <ul>
              {(Array.isArray(plan.features) ? plan.features : [])
                .slice(0, 5)
                .map((feature: ApiRecord) => (
                  <li key={text(feature.code)}>
                    <Check /> {text(feature.code).replaceAll("_", " ")}
                  </li>
                ))}
            </ul>
            <button className="button secondary wide">Choose plan</button>
          </article>
        ))}
      </section>
      <article className="card quota-card wide-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Current period</p>
            <h2>Quota usage</h2>
          </div>
        </div>
        <DataState
          loading={quotas.loading}
          error={quotas.error}
          empty={!quotaRows.length}
        >
          <div className="quota-list grid-quota">
            {quotaRows.map((row) => {
              const percent = number(row.quota)
                ? Math.min((number(row.used) / number(row.quota)) * 100, 100)
                : 0;
              return (
                <div key={text(row.code)}>
                  <div>
                    <span>{text(row.code).replaceAll("_", " ")}</span>
                    <strong>{formatNumber(row.remaining)} left</strong>
                  </div>
                  <progress max="100" value={percent} />
                  <small>
                    {formatNumber(row.used)} of {formatNumber(row.quota)} used
                  </small>
                </div>
              );
            })}
          </div>
        </DataState>
      </article>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Invoices</h2>
          <span>{listOf(payments.data).length} payments</span>
        </div>
        <DataState
          loading={invoices.loading}
          error={invoices.error}
          empty={!invoiceRows.length}
        >
          <SimpleTable
            rows={invoiceRows}
            columns={[
              {
                key: "id",
                label: "Invoice",
                render: (row) => `#${text(row.id).slice(0, 8)}`,
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "total_minor",
                label: "Amount",
                render: (row) =>
                  `${text(row.currency)} ${(number(row.total_minor) / 100).toFixed(2)}`,
              },
              {
                key: "issued_at",
                label: "Issued",
                render: (row) => (
                  <DateCell value={row.issued_at ?? row.created_at} />
                ),
              },
              {
                key: "pdf_url",
                label: "",
                render: (row) =>
                  row.pdf_url ? (
                    <a
                      className="row-link"
                      href={String(row.pdf_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowDownToLine /> PDF
                    </a>
                  ) : null,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function WorkspacePage() {
  const me = useApi<ApiRecord>("/auth/me");
  const workspace = useApi<ApiRecord>("/workspace");
  const members = useApi<unknown>("/workspace/members?limit=100");
  const roles = useApi<unknown>("/workspace/roles");
  const invitations = useApi<unknown>("/workspace/invitations?limit=100");
  const sessions = useApi<unknown>("/auth/sessions");
  const securityEvents = useApi<unknown>("/workspace/security-events?limit=50");
  const auditLogs = useApi<unknown>("/workspace/audit-logs?limit=50");
  const action = useAction();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const memberRows = listOf(members.data);
  const roleRows = listOf(roles.data);
  const invitationRows = listOf(invitations.data);
  const sessionRows = listOf(sessions.data);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await action.run(
      () =>
        api<ApiRecord>("/workspace/invitations", {
          method: "POST",
          body: JSON.stringify(values),
        }),
      "Invitation created.",
    );
    if (result) {
      setInviteToken(text(result.token, ""));
      setShowInvite(false);
      event.currentTarget.reset();
      void invitations.refresh();
    }
  }

  async function revokeSession(id: unknown) {
    const result = await action.run(
      () =>
        api(`/auth/sessions/${id}/revoke`, {
          method: "POST",
          body: JSON.stringify({ reason: "Revoked from workspace settings" }),
        }),
      "Session revoked.",
    );
    if (result) void sessions.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Phase 1"
        title="Team & access"
        description={`${text(workspace.data?.name, "Workspace")} identity, roles, invitations, sessions, and security activity.`}
        actions={
          <button
            className="button primary"
            onClick={() => setShowInvite((value) => !value)}
          >
            <Plus /> Invite member
          </button>
        }
      />
      <FormFeedback error={action.error} message={action.message} />
      {inviteToken && (
        <Notice success>
          <strong>Invitation link created.</strong>
          <br />
          <a
            className="row-link"
            href={`/accept-invitation?token=${encodeURIComponent(inviteToken)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open invitation signup
          </a>{" "}
          · Copy this link and send it securely to the invited person.
        </Notice>
      )}
      {showInvite && (
        <article className="card inline-form">
          <h2>Invite a member</h2>
          <form className="form-grid" onSubmit={invite}>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="roleId" required>
                <option value="">Choose role</option>
                {roleRows.map((role) => (
                  <option key={text(role.id)} value={text(role.id)}>
                    {text(role.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expires in days
              <input
                name="expiresInDays"
                type="number"
                min="1"
                max="30"
                defaultValue="7"
                required
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={action.working}>
                Create invitation
              </button>
            </div>
          </form>
        </article>
      )}
      <section className="metric-grid four">
        <Metric
          label="Members"
          value={formatNumber(memberRows.length)}
          hint={text((me.data?.user as ApiRecord)?.email, "")}
        />
        <Metric
          label="Pending invites"
          value={formatNumber(
            invitationRows.filter((row) => text(row.status) === "PENDING")
              .length,
          )}
        />
        <Metric
          label="Active sessions"
          value={formatNumber(
            sessionRows.filter((row) => !row.revokedAt).length,
          )}
        />
        <Metric
          label="Security events"
          value={formatNumber(listOf(securityEvents.data).length)}
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Workspace members</h2>
        </div>
        <DataState
          loading={members.loading}
          error={members.error}
          empty={!memberRows.length}
        >
          <SimpleTable
            rows={memberRows}
            columns={[
              { key: "fullName", label: "Member" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "joinedAt",
                label: "Joined",
                render: (row) => <DateCell value={row.joinedAt} />,
              },
            ]}
          />
        </DataState>
      </article>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Invitations</h2>
          </div>
          <DataState
            loading={invitations.loading}
            error={invitations.error}
            empty={!invitationRows.length}
          >
            <SimpleTable
              rows={invitationRows}
              columns={[
                { key: "email", label: "Email" },
                { key: "role", label: "Role" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                {
                  key: "expiresAt",
                  label: "Expires",
                  render: (row) => <DateCell value={row.expiresAt} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Your sessions</h2>
          </div>
          <DataState
            loading={sessions.loading}
            error={sessions.error}
            empty={!sessionRows.length}
          >
            <SimpleTable
              rows={sessionRows}
              columns={[
                {
                  key: "createdAt",
                  label: "Started",
                  render: (row) => <DateCell value={row.createdAt} />,
                },
                { key: "ipAddress", label: "IP" },
                {
                  key: "revokedAt",
                  label: "Status",
                  render: (row) => (
                    <Status value={row.revokedAt ? "revoked" : "active"} />
                  ),
                },
                {
                  key: "action",
                  label: "",
                  render: (row) =>
                    !row.revokedAt ? (
                      <button
                        className="row-link"
                        onClick={() => void revokeSession(row.id)}
                      >
                        Revoke
                      </button>
                    ) : null,
                },
              ]}
            />
          </DataState>
        </article>
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Security events</h2>
          </div>
          <DataState
            loading={securityEvents.loading}
            error={securityEvents.error}
            empty={!listOf(securityEvents.data).length}
          >
            <SimpleTable
              rows={listOf(securityEvents.data)}
              columns={[
                { key: "eventType", label: "Event" },
                {
                  key: "severity",
                  label: "Severity",
                  render: (row) => <Status value={row.severity} />,
                },
                {
                  key: "createdAt",
                  label: "Occurred",
                  render: (row) => <DateCell value={row.createdAt} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Audit log</h2>
          </div>
          <DataState
            loading={auditLogs.loading}
            error={auditLogs.error}
            empty={!listOf(auditLogs.data).length}
          >
            <SimpleTable
              rows={listOf(auditLogs.data)}
              columns={[
                { key: "action", label: "Action" },
                { key: "resourceType", label: "Resource" },
                {
                  key: "createdAt",
                  label: "Occurred",
                  render: (row) => <DateCell value={row.createdAt} />,
                },
              ]}
            />
          </DataState>
        </article>
      </section>
    </>
  );
}

export function SettingsPage() {
  const existing = readSession();
  const [apiUrl, setApiUrl] = useState(existing?.apiUrl ?? "");
  const [organizationId, setOrganizationId] = useState(
    existing?.organizationId ?? "",
  );
  const action = useAction();

  function save(event: FormEvent) {
    event.preventDefault();
    if (!existing) return;
    saveSession({
      ...existing,
      apiUrl: apiUrl.replace(/\/$/, ""),
      organizationId,
    });
    void action.run(
      async () => true,
      "Workspace settings saved for this browser tab.",
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage the current API connection and organization context."
      />
      <FormFeedback error={action.error} message={action.message} />
      <article className="card settings-card">
        <div>
          <h2>API connection</h2>
          <p>
            Changing the organization switches the tenant context sent with
            every API request.
          </p>
        </div>
        <form onSubmit={save}>
          <label>
            API URL
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
            />
          </label>
          <label>
            Organization ID
            <input
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button className="button primary">Save changes</button>
          </div>
        </form>
      </article>
      <article className="card settings-card">
        <div>
          <h2>Security posture</h2>
          <p>
            Your access token is held in session storage and is not persisted
            after this browser tab closes.
          </p>
        </div>
        <div className="security-list">
          <span>
            <ShieldCheck /> Tenant header attached
          </span>
          <span>
            <ShieldCheck /> Bearer authentication enabled
          </span>
          <span>
            <ShieldCheck /> No secrets committed to frontend source
          </span>
        </div>
      </article>
    </>
  );
}

export function NotFoundPage() {
  return (
    <article className="not-found">
      <span>404</span>
      <h1>Page not found</h1>
      <p>The workspace page you requested does not exist.</p>
      <a className="button primary" href="/">
        Return to dashboard
      </a>
    </article>
  );
}
