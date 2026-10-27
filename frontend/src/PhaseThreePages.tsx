import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ContactRound,
  FileUp,
  Megaphone,
  MessageCircleMore,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  download,
  formatDate,
  formatNumber,
  listOf,
  text,
  type ApiRecord,
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
import { parseObject, recipientPayload } from "./phase-three-utils";

function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  if (action.error) return <Notice>{action.error}</Notice>;
  if (action.message) return <Notice success>{action.message}</Notice>;
  return null;
}

export function ContactDirectoryPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const contacts = useApi<unknown>(
    `/contacts?limit=100&page=1${query ? `&search=${encodeURIComponent(query)}` : ""}`,
  );
  const imports = useApi<unknown>("/contacts/imports");
  const action = useAction();
  const rows = listOf(contacts.data);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    if (!values.email) delete values.email;
    const result = await action.run(
      () =>
        api("/contacts", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            customAttributes: {},
            source: "MANUAL",
          }),
        }),
      "Contact created.",
    );
    if (result) {
      form.reset();
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
      "Import queued.",
    );
    if (result) void imports.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Phase 3 · Audience"
        title="Contacts"
        description="Search tenant contacts, manage consent, and monitor privacy-safe imports."
        actions={
          <>
            <button
              className="button ghost"
              onClick={() =>
                void download(
                  "/contacts/imports/sample",
                  "contact-import-template.csv",
                )
              }
            >
              <ArrowDownToLine /> Sample
            </button>
            <label className="button secondary file-button">
              <FileUp /> Import CSV/XLSX
              <input type="file" accept=".csv,.xlsx" onChange={upload} />
            </label>
            <button
              className="button primary"
              onClick={() => setShowCreate((value) => !value)}
            >
              <Plus /> Add contact
            </button>
          </>
        }
      />
      <Feedback action={action} />
      {showCreate && (
        <article className="card inline-form">
          <h2>Add contact</h2>
          <form className="form-grid" onSubmit={create}>
            <label>
              Full name
              <input name="fullName" required maxLength={150} />
            </label>
            <label>
              Country code
              <input
                name="countryCode"
                required
                pattern="[A-Z]{2}"
                placeholder="IN"
              />
            </label>
            <label>
              Phone (E.164)
              <input
                name="phoneE164"
                required
                pattern="\+[1-9][0-9]{1,14}"
                placeholder="+919876543210"
              />
            </label>
            <label>
              Email
              <input name="email" type="email" maxLength={254} />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button ghost"
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
            Contacts
          </span>
        </div>
        <div>
          <FileUp />
          <span>
            <strong>{listOf(imports.data).length}</strong>Recent imports
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>Protected</strong>Consent and suppression
          </span>
        </div>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Contact directory</h2>
          <form
            className="table-search"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
            }}
          >
            <input
              className="small-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, or email"
            />
            <button className="button secondary">Search</button>
          </form>
        </div>
        <DataState
          loading={contacts.loading}
          error={contacts.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              {
                key: "full_name",
                label: "Contact",
                render: (row) => (
                  <Link className="row-link" to={`/contacts/${row.id}`}>
                    {text(row.full_name)}
                  </Link>
                ),
              },
              { key: "phone_e164", label: "Phone" },
              { key: "email", label: "Email" },
              { key: "source", label: "Source" },
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
      <article className="card table-card">
        <div className="card-heading">
          <h2>Import jobs</h2>
        </div>
        <DataState
          loading={imports.loading}
          error={imports.error}
          empty={!listOf(imports.data).length}
        >
          <SimpleTable
            rows={listOf(imports.data)}
            columns={[
              { key: "file_type", label: "Type" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "accepted_rows", label: "Accepted" },
              { key: "rejected_rows", label: "Rejected" },
              {
                key: "created_at",
                label: "Started",
                render: (row) => <DateCell value={row.created_at} />,
              },
              {
                key: "open",
                label: "",
                render: (row) => (
                  <Link className="row-link" to={`/contacts/imports/${row.id}`}>
                    View
                  </Link>
                ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function ContactDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const contact = useApi<ApiRecord>(id ? `/contacts/${id}` : null);
  const action = useAction();
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    if (!values.email) delete values.email;
    const result = await action.run(
      () =>
        api(`/contacts/${id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        }),
      "Contact updated.",
    );
    if (result) void contact.refresh();
  }
  async function recordConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action.run(
      () =>
        api("/contacts/consents", {
          method: "POST",
          body: JSON.stringify({ contactId: id, ...values }),
        }),
      "Consent event recorded.",
    );
  }
  async function remove() {
    if (
      !window.confirm(
        "Delete this contact? Historical message records will remain.",
      )
    )
      return;
    const result = await action.run(async () => {
      await api(`/contacts/${id}`, { method: "DELETE" });
      return true;
    }, "Contact deleted.");
    if (result) navigate("/contacts");
  }
  const value = contact.data;
  return (
    <>
      <PageHeader
        eyebrow="Contact profile"
        title={text(value?.full_name, "Contact")}
        description={text(value?.phone_e164)}
        actions={
          <>
            <Link className="button ghost" to="/contacts">
              <ArrowLeft /> Contacts
            </Link>
            <button className="button danger" onClick={() => void remove()}>
              <Trash2 /> Delete
            </button>
          </>
        }
      />
      <Feedback action={action} />
      <DataState loading={contact.loading} error={contact.error} empty={!value}>
        {value && (
          <section className="two-column">
            <article className="card inline-form">
              <h2>Profile</h2>
              <form
                className="form-grid"
                onSubmit={update}
                key={text(value.updated_at)}
              >
                <label>
                  Full name
                  <input
                    name="fullName"
                    defaultValue={text(value.full_name, "")}
                    required
                    maxLength={150}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    defaultValue={text(value.email, "")}
                    maxLength={254}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={text(value.status, "ACTIVE")}
                  >
                    <option>ACTIVE</option>
                    <option>SUPPRESSED</option>
                  </select>
                </label>
                <div className="form-actions">
                  <button className="button primary" disabled={action.working}>
                    Save changes
                  </button>
                </div>
              </form>
            </article>
            <article className="card inline-form">
              <h2>Record consent</h2>
              <form className="form-grid" onSubmit={recordConsent}>
                <label>
                  Purpose
                  <select name="purpose">
                    <option>MARKETING</option>
                    <option>TRANSACTIONAL</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status">
                    <option>OPTED_IN</option>
                    <option>OPTED_OUT</option>
                  </select>
                </label>
                <label>
                  Source
                  <input name="source" defaultValue="MANUAL" required />
                </label>
                <label>
                  Policy version
                  <input name="policyVersion" defaultValue="1.0" required />
                </label>
                <label>
                  Evidence reference
                  <input name="evidenceReference" maxLength={500} />
                </label>
                <div className="form-actions">
                  <button
                    className="button secondary"
                    disabled={action.working}
                  >
                    Record event
                  </button>
                </div>
              </form>
            </article>
          </section>
        )}
      </DataState>
    </>
  );
}

export function AudiencePage() {
  const tags = useApi<unknown>("/contacts/tags");
  const segments = useApi<unknown>("/contacts/segments");
  const [selected, setSelected] = useState("");
  const segment = useApi<ApiRecord>(
    selected ? `/contacts/segments/${selected}` : null,
  );
  const action = useAction();
  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    const result = await action.run(
      () =>
        api("/contacts/tags", {
          method: "POST",
          body: JSON.stringify({ name }),
        }),
      "Tag created.",
    );
    if (result) {
      form.reset();
      void tags.refresh();
    }
  }
  async function createSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const result = await action.run(
      async () =>
        api("/contacts/segments", {
          method: "POST",
          body: JSON.stringify({
            name: values.name,
            definition: parseObject(values.definition, "Segment definition"),
          }),
        }),
      "Segment created.",
    );
    if (result) {
      form.reset();
      void segments.refresh();
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Phase 3 · Audience"
        title="Tags and segments"
        description="Define reusable audience metadata without bypassing consent checks."
        actions={
          <Link className="button ghost" to="/contacts">
            <ArrowLeft /> Contacts
          </Link>
        }
      />
      <Feedback action={action} />
      <section className="two-column">
        <article className="card inline-form">
          <h2>Create tag</h2>
          <form className="form-grid one-column" onSubmit={createTag}>
            <label>
              Tag name
              <input name="name" required maxLength={100} />
            </label>
            <button className="button primary" disabled={action.working}>
              Create tag
            </button>
          </form>
          <div className="chip-list">
            {listOf(tags.data).map((tag) => (
              <span key={text(tag.id)}>{text(tag.name)}</span>
            ))}
          </div>
        </article>
        <article className="card inline-form">
          <h2>Create segment</h2>
          <form className="form-grid one-column" onSubmit={createSegment}>
            <label>
              Name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Definition JSON
              <textarea
                name="definition"
                defaultValue={'{"status":"ACTIVE"}'}
                rows={4}
                required
              />
            </label>
            <button className="button primary" disabled={action.working}>
              Create segment
            </button>
          </form>
        </article>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Segments</h2>
        </div>
        <DataState
          loading={segments.loading}
          error={segments.error}
          empty={!listOf(segments.data).length}
        >
          <SimpleTable
            rows={listOf(segments.data)}
            columns={[
              { key: "name", label: "Name" },
              {
                key: "created_at",
                label: "Created",
                render: (row) => <DateCell value={row.created_at} />,
              },
              {
                key: "open",
                label: "",
                render: (row) => (
                  <button
                    className="row-link"
                    onClick={() => setSelected(text(row.id, ""))}
                  >
                    Inspect
                  </button>
                ),
              },
            ]}
          />
        </DataState>
      </article>
      {selected && (
        <article className="card detail-list">
          <div>
            <span>Segment</span>
            <strong>{text(segment.data?.name)}</strong>
          </div>
          <div>
            <span>Definition</span>
            <code>{JSON.stringify(segment.data?.definition ?? {})}</code>
          </div>
          {segment.error && <Notice>{segment.error}</Notice>}
        </article>
      )}
    </>
  );
}

export function ImportDetailPage() {
  const { id = "" } = useParams();
  const item = useApi<ApiRecord>(id ? `/contacts/imports/${id}` : null);
  const errors = Array.isArray(item.data?.errors)
    ? (item.data.errors as ApiRecord[])
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Contact import"
        title={`Import ${id.slice(0, 8)}`}
        description="Review accepted rows and privacy-safe validation failures."
        actions={
          <>
            <Link className="button ghost" to="/contacts">
              <ArrowLeft /> Contacts
            </Link>
            <button
              className="button secondary"
              onClick={() => void item.refresh()}
            >
              <RefreshCw /> Refresh
            </button>
            {item.data?.error_object_key && (
              <button
                className="button primary"
                onClick={() =>
                  void download(
                    `/contacts/imports/${id}/errors`,
                    `contact-import-${id}-errors.csv`,
                  )
                }
              >
                <ArrowDownToLine /> Error report
              </button>
            )}
          </>
        }
      />
      <section className="metric-grid four">
        <Metric label="Status" value={text(item.data?.status)} />
        <Metric
          label="Total rows"
          value={formatNumber(item.data?.total_rows)}
        />
        <Metric
          label="Accepted"
          value={formatNumber(item.data?.accepted_rows)}
          tone="green"
        />
        <Metric
          label="Rejected"
          value={formatNumber(item.data?.rejected_rows)}
          tone="amber"
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>First 100 validation errors</h2>
        </div>
        <DataState
          loading={item.loading}
          error={item.error}
          empty={!errors.length}
        >
          <SimpleTable
            rows={errors}
            columns={[
              { key: "row", label: "Row" },
              { key: "code", label: "Code" },
              { key: "message", label: "Reason" },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

function SenderAndTemplateFields({
  accountId,
  setAccountId,
}: {
  accountId: string;
  setAccountId(value: string): void;
}) {
  const accounts = useApi<unknown>("/whatsapp/accounts");
  const phones = useApi<unknown>(
    accountId ? `/whatsapp/accounts/${accountId}/phone-numbers` : null,
  );
  const templates = useApi<unknown>("/templates?limit=100");
  return (
    <>
      <label>
        WhatsApp account
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          required
        >
          <option value="">Choose account</option>
          {listOf(accounts.data).map((row) => (
            <option key={text(row.id)} value={text(row.id)}>
              {text(row.businessName)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sender
        <select name="senderId" disabled={!accountId} required>
          <option value="">Choose sender</option>
          {listOf(phones.data).map((row) => (
            <option key={text(row.id)} value={text(row.id)}>
              {text(row.verifiedDisplayName, text(row.displayPhoneNumber))}
            </option>
          ))}
        </select>
      </label>
      <label>
        Approved template
        <select name="templateId" required>
          <option value="">Choose template</option>
          {listOf(templates.data)
            .filter((row) => text(row.metaStatus) === "APPROVED")
            .map((row) => (
              <option key={text(row.id)} value={text(row.id)}>
                {text(row.name)} · {text(row.language)}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}

export function MessageCenterPage() {
  const messages = useApi<unknown>("/messages?limit=100&page=1");
  const contacts = useApi<unknown>("/contacts?limit=100&page=1&status=ACTIVE");
  const action = useAction();
  const [compose, setCompose] = useState(false);
  const [accountId, setAccountId] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const result = await action.run(
      async () =>
        api("/messages/template", {
          method: "POST",
          body: JSON.stringify({
            contactId: values.contactId || undefined,
            recipientPhone: values.contactId
              ? undefined
              : values.recipientPhone,
            senderId: values.senderId,
            templateId: values.templateId,
            language: values.language,
            parameters: parseObject(values.parameters, "Template parameters"),
            idempotencyKey: crypto.randomUUID(),
          }),
        }),
      "Message accepted for asynchronous delivery.",
    );
    if (result) {
      setCompose(false);
      void messages.refresh();
    }
  }
  const rows = listOf(messages.data);
  return (
    <>
      <PageHeader
        eyebrow="Phase 3 · Messaging"
        title="Message log"
        description="Send approved templates and follow the provider-confirmed delivery lifecycle."
        actions={
          <>
            <Link className="button secondary" to="/messages/bulk">
              <UsersRound /> Bulk message
            </Link>
            <button
              className="button primary"
              onClick={() => setCompose((value) => !value)}
            >
              <Send /> Send message
            </button>
          </>
        }
      />
      <Feedback action={action} />
      {compose && (
        <article className="card inline-form">
          <h2>Send approved template</h2>
          <form className="form-grid" onSubmit={send}>
            <label>
              Existing contact
              <select name="contactId">
                <option value="">Use phone instead</option>
                {listOf(contacts.data).map((row) => (
                  <option key={text(row.id)} value={text(row.id)}>
                    {text(row.full_name)} · {text(row.phone_e164)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recipient phone
              <input
                name="recipientPhone"
                placeholder="+919876543210"
                pattern="\+[1-9][0-9]{1,14}"
              />
            </label>
            <SenderAndTemplateFields
              accountId={accountId}
              setAccountId={setAccountId}
            />
            <label>
              Language
              <input name="language" defaultValue="en" required />
            </label>
            <label>
              Parameters JSON
              <textarea name="parameters" defaultValue="{}" rows={3} required />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setCompose(false)}
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
          value={
            rows.filter((row) =>
              ["DELIVERED", "READ"].includes(text(row.status)),
            ).length
          }
          tone="green"
        />
        <Metric
          label="Read"
          value={rows.filter((row) => text(row.status) === "READ").length}
        />
        <Metric
          label="Failed"
          value={rows.filter((row) => text(row.status) === "FAILED").length}
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
              {
                key: "recipient",
                label: "Recipient",
                render: (row) => (
                  <Link className="row-link" to={`/messages/${row.id}`}>
                    {text(row.recipient)}
                  </Link>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "raw_provider_status", label: "Provider status" },
              { key: "error_code", label: "Error" },
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

export function MessageDetailPage() {
  const { id = "" } = useParams();
  const message = useApi<ApiRecord>(id ? `/messages/${id}` : null);
  const history = Array.isArray(message.data?.status_history)
    ? (message.data.status_history as ApiRecord[])
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Message trace"
        title={`Message ${id.slice(0, 8)}`}
        description="Provider status history without exposing message credentials or unmasked recipients."
        actions={
          <Link className="button ghost" to="/messages">
            <ArrowLeft /> Messages
          </Link>
        }
      />
      <section className="summary-strip">
        <div>
          <MessageCircleMore />
          <span>
            <strong>{text(message.data?.status)}</strong>Current status
          </span>
        </div>
        <div>
          <Send />
          <span>
            <strong>{text(message.data?.recipient)}</strong>Recipient
          </span>
        </div>
        <div>
          <Megaphone />
          <span>
            <strong>{text(message.data?.error_code, "None")}</strong>Provider
            error
          </span>
        </div>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Status timeline</h2>
        </div>
        <DataState
          loading={message.loading}
          error={message.error}
          empty={!history.length}
        >
          <SimpleTable
            rows={history}
            columns={[
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "rawStatus", label: "Provider status" },
              {
                key: "providerTimestamp",
                label: "Provider time",
                render: (row) => <DateCell value={row.providerTimestamp} />,
              },
              {
                key: "receivedAt",
                label: "Received",
                render: (row) => <DateCell value={row.receivedAt} />,
              },
              { key: "errorCode", label: "Error" },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

function CampaignComposer({ bulk = false }: { bulk?: boolean }) {
  const navigate = useNavigate();
  const subscription = useApi<ApiRecord>("/billing/subscription");
  const hasActivePlan = ["TRIALING", "ACTIVE", "PAST_DUE"].includes(
    text(subscription.data?.status, ""),
  );
  const contacts = useApi<unknown>(
    hasActivePlan ? "/contacts?limit=100&page=1&status=ACTIVE" : null,
  );
  const segments = useApi<unknown>(hasActivePlan ? "/contacts/segments" : null);
  const action = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [accountId, setAccountId] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    const result = await action.run(
      async () => {
        const payload = {
          name: values.name,
          description: values.description || undefined,
          senderId: values.senderId,
          templateId: values.templateId,
          segmentId: values.segmentId || undefined,
          scheduledAt: values.scheduledAt
            ? new Date(values.scheduledAt).toISOString()
            : undefined,
          timezone: values.timezone,
          recipients: recipientPayload(
            selected,
            parseObject(values.parameters, "Recipient parameters"),
          ),
        };
        return api<ApiRecord>(bulk ? "/messages/bulk" : "/campaigns", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      bulk ? "Bulk campaign accepted." : "Campaign draft created.",
    );
    if (result) navigate(`/campaigns/${result.id}`);
  }
  const header = (
    <PageHeader
      eyebrow={`Phase 3 · ${bulk ? "Bulk messaging" : "Campaigns"}`}
      title={bulk ? "Send bulk message" : "Create campaign"}
      description="Recipients remain subject to consent, suppression, sender, template, and quota validation."
      actions={
        <Link className="button ghost" to="/campaigns">
          <ArrowLeft /> Campaigns
        </Link>
      }
    />
  );
  if (subscription.loading)
    return (
      <>
        {header}
        <DataState loading error="" empty={false}>
          <span />
        </DataState>
      </>
    );
  if (!hasActivePlan)
    return (
      <>
        {header}
        <Notice>
          <strong>You don't have an active plan.</strong>
          <br />
          Start the free trial or choose a plan before creating a campaign.
          <div className="form-actions">
            <Link className="button primary" to="/billing">
              View plans
            </Link>
          </div>
        </Notice>
      </>
    );
  return (
    <>
      {header}
      <Feedback action={action} />
      <form className="campaign-builder" onSubmit={submit}>
        <article className="card template-form">
          <div className="form-grid">
            <label>
              Name
              <input name="name" required maxLength={150} />
            </label>
            <label>
              Timezone
              <input
                name="timezone"
                defaultValue="UTC"
                required
                maxLength={64}
              />
            </label>
            <label>
              Description
              <input name="description" maxLength={1000} />
            </label>
            <label>
              Schedule
              <input name="scheduledAt" type="datetime-local" />
            </label>
            <SenderAndTemplateFields
              accountId={accountId}
              setAccountId={setAccountId}
            />
            <label>
              Saved segment
              <select name="segmentId">
                <option value="">Direct recipients</option>
                {listOf(segments.data).map((row) => (
                  <option key={text(row.id)} value={text(row.id)}>
                    {text(row.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recipient parameters JSON
              <textarea name="parameters" defaultValue="{}" rows={3} required />
            </label>
          </div>
          <div className="form-actions">
            <button
              className="button primary"
              disabled={action.working || !selected.length}
            >
              <Check /> {bulk ? "Validate and launch" : "Save draft"}
            </button>
          </div>
        </article>
        <article className="card recipient-picker">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Eligible candidates</p>
              <h2>Select contacts</h2>
            </div>
            <strong>{selected.length} selected</strong>
          </div>
          <DataState
            loading={contacts.loading}
            error={contacts.error}
            empty={!listOf(contacts.data).length}
          >
            <div className="check-list">
              {listOf(contacts.data).map((row) => {
                const id = text(row.id, "");
                return (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, id]
                            : current.filter((value) => value !== id),
                        )
                      }
                    />
                    <span>
                      <strong>{text(row.full_name)}</strong>
                      <small>{text(row.phone_e164)}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </DataState>
        </article>
      </form>
    </>
  );
}

export function CampaignBuilderPage() {
  return <CampaignComposer />;
}
export function BulkMessagePage() {
  return <CampaignComposer bulk />;
}

export function CampaignManagerPage() {
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
        eyebrow="Phase 3 · Engagement"
        title="Campaigns"
        description="Create, validate, schedule, pause, resume, and cancel durable campaign executions."
        actions={
          <Link className="button primary" to="/campaigns/new">
            <Plus /> New campaign
          </Link>
        }
      />
      <Feedback action={action} />
      <section className="metric-grid four">
        <Metric
          label="All"
          value={formatNumber(
            (campaigns.data as ApiRecord)?.total ?? rows.length,
          )}
          tone="blue"
        />
        <Metric
          label="Running"
          value={
            rows.filter((row) =>
              ["RUNNING", "QUEUED"].includes(text(row.status)),
            ).length
          }
          tone="green"
        />
        <Metric
          label="Scheduled"
          value={rows.filter((row) => text(row.status) === "SCHEDULED").length}
        />
        <Metric
          label="Drafts"
          value={rows.filter((row) => text(row.status) === "DRAFT").length}
          tone="amber"
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Campaign manager</h2>
        </div>
        <DataState
          loading={campaigns.loading}
          error={campaigns.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              {
                key: "name",
                label: "Campaign",
                render: (row) => (
                  <Link className="row-link" to={`/campaigns/${row.id}`}>
                    {text(row.name)}
                  </Link>
                ),
              },
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
                render: (row) => {
                  const status = text(row.status);
                  return (
                    <div className="row-actions">
                      {status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => void transition(row.id, "validate")}
                          >
                            Validate
                          </button>
                          <button
                            onClick={() => void transition(row.id, "launch")}
                          >
                            Launch
                          </button>
                        </>
                      )}
                      {["SCHEDULED", "QUEUED", "RUNNING"].includes(status) && (
                        <button
                          onClick={() => void transition(row.id, "pause")}
                        >
                          Pause
                        </button>
                      )}
                      {status === "PAUSED" && (
                        <button
                          onClick={() => void transition(row.id, "resume")}
                        >
                          Resume
                        </button>
                      )}
                      {!["COMPLETED", "CANCELLED", "FAILED"].includes(
                        status,
                      ) && (
                        <button
                          onClick={() => void transition(row.id, "cancel")}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function CampaignDetailPage() {
  const { id = "" } = useParams();
  const campaign = useApi<ApiRecord>(id ? `/campaigns/${id}` : null);
  const recipients = useApi<unknown>(id ? `/campaigns/${id}/recipients` : null);
  const metrics = useApi<ApiRecord>(id ? `/campaigns/${id}/metrics` : null);
  const action = useAction();
  const [validation, setValidation] = useState<ApiRecord | null>(null);
  const status = text(campaign.data?.status, "");
  async function operation(name: string) {
    const result = await action.run(
      () => api<ApiRecord>(`/campaigns/${id}/${name}`, { method: "POST" }),
      `Campaign ${name} completed.`,
    );
    if (result) {
      if (name === "validate") setValidation(result);
      void campaign.refresh();
      void metrics.refresh();
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Campaign execution"
        title={text(campaign.data?.name, "Campaign")}
        description={`${text(campaign.data?.timezone, "UTC")} · ${formatDate(campaign.data?.scheduled_at ?? campaign.data?.created_at)}`}
        actions={
          <>
            <Link className="button ghost" to="/campaigns">
              <ArrowLeft /> Campaigns
            </Link>
            {status === "DRAFT" && (
              <>
                <button
                  className="button secondary"
                  onClick={() => void operation("validate")}
                >
                  Validate
                </button>
                <button
                  className="button primary"
                  onClick={() => void operation("launch")}
                >
                  <Send /> Launch
                </button>
              </>
            )}
          </>
        }
      />
      <Feedback action={action} />
      {validation && (
        <Notice success={Boolean(validation.valid)}>
          <strong>
            {validation.valid
              ? "Validation passed"
              : "Validation requires attention"}
          </strong>
          <br />
          {Array.isArray(validation.errors)
            ? validation.errors.join(" · ")
            : `${formatNumber(validation.eligible)} eligible recipients`}
        </Notice>
      )}
      <section className="metric-grid four">
        <Metric label="Status" value={text(campaign.data?.status)} />
        <Metric
          label="Delivered"
          value={formatNumber(metrics.data?.delivered)}
          tone="green"
        />
        <Metric label="Read" value={formatNumber(metrics.data?.read)} />
        <Metric
          label="Failed"
          value={formatNumber(metrics.data?.failed)}
          tone="amber"
        />
      </section>
      <div className="campaign-actions">
        {["SCHEDULED", "QUEUED", "RUNNING"].includes(status) && (
          <button
            className="button secondary"
            onClick={() => void operation("pause")}
          >
            Pause
          </button>
        )}
        {status === "PAUSED" && (
          <button
            className="button secondary"
            onClick={() => void operation("resume")}
          >
            Resume
          </button>
        )}
        {status && !["COMPLETED", "CANCELLED", "FAILED"].includes(status) ? (
          <button
            className="button danger"
            onClick={() => void operation("cancel")}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Recipients</h2>
          <span>{listOf(recipients.data).length} loaded</span>
        </div>
        <DataState
          loading={recipients.loading}
          error={recipients.error}
          empty={!listOf(recipients.data).length}
        >
          <SimpleTable
            rows={listOf(recipients.data)}
            columns={[
              { key: "full_name", label: "Contact" },
              { key: "phone_e164", label: "Phone" },
              {
                key: "eligibility",
                label: "Eligibility",
                render: (row) => <Status value={row.eligibility} />,
              },
              { key: "reason", label: "Reason" },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}
