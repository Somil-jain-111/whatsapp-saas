import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Tag,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  authenticatedStream,
  download,
  formatDate,
  formatNumber,
  listOf,
  number,
  text,
} from "./api";
import type { ApiRecord } from "./api";
import {
  DataState,
  Metric,
  Notice,
  PageHeader,
  SimpleTable,
  Status,
} from "./components";
import { useAction, useApi } from "./hooks";
import { parseInboxEventFrames } from "./inbox-events";

function messagePreview(message: ApiRecord) {
  const content = text(message.content);
  if (message.message_type !== "INTERACTIVE" || !content)
    return (
      content ||
      (message.message_type === "TEXT"
        ? "Message unavailable"
        : `${text(message.message_type)} message`)
    );
  try {
    const interactive = JSON.parse(content) as {
      body?: string;
      buttons?: Array<{ title?: string }>;
      sections?: Array<{ rows?: Array<{ title?: string }> }>;
    };
    const options = [
      ...(interactive.buttons ?? []),
      ...(interactive.sections ?? []).flatMap((section) => section.rows ?? []),
    ]
      .map((option) => option.title)
      .filter(Boolean);
    return [interactive.body, options.length ? options.join(" · ") : null]
      .filter(Boolean)
      .join(" — ");
  } catch {
    return "Interactive message";
  }
}

function useInboxEvents(refresh: () => Promise<void>) {
  useEffect(() => {
    const controller = new AbortController();
    let cursor = sessionStorage.getItem("relay.inbox.cursor") ?? "0";
    void (async () => {
      try {
        const stream = await authenticatedStream(
          `/inbox/events?cursor=${encodeURIComponent(cursor)}`,
          controller.signal,
        );
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const parsed = parseInboxEventFrames(buffer);
          buffer = parsed.rest;
          if (parsed.events.some((event) => event.event !== "heartbeat"))
            await refresh();
          const last = parsed.events.findLast((event) => event.id)?.id;
          if (last) {
            cursor = last;
            sessionStorage.setItem("relay.inbox.cursor", last);
          }
        }
      } catch {
        // The next page refresh restores the stream from the durable cursor.
      }
    })();
    return () => controller.abort();
  }, [refresh]);
}

export function SharedInboxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const query = `/conversations?limit=50${status ? `&status=${status}` : ""}${agentFilter ? `&agentId=${agentFilter}` : ""}${labelFilter ? `&labelId=${labelFilter}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const conversations = useApi<ApiRecord>(query);
  const detail = useApi<ApiRecord>(id ? `/conversations/${id}` : null);
  const messages = useApi<ApiRecord[]>(
    id ? `/conversations/${id}/messages` : null,
  );
  const notes = useApi<ApiRecord[]>(id ? `/conversations/${id}/notes` : null);
  const labels = useApi<ApiRecord[]>("/inbox/labels");
  const agents = useApi<ApiRecord[]>("/inbox/agents");
  const activity = useApi<ApiRecord[]>(
    id ? `/conversations/${id}/activity` : null,
  );
  const templates = useApi<ApiRecord>("/templates?limit=100");
  const action = useAction();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<
    | "TEXT"
    | "TEMPLATE"
    | "IMAGE"
    | "DOCUMENT"
    | "VIDEO"
    | "INTERACTIVE_BUTTON"
    | "INTERACTIVE_LIST"
  >("TEXT");
  const [templateId, setTemplateId] = useState("");
  const [media, setMedia] = useState<ApiRecord | null>(null);
  const [interactiveBody, setInteractiveBody] = useState("");
  const [interactiveOptions, setInteractiveOptions] = useState(
    "support|Talk to support\norders|Order status",
  );
  const refreshConversations = conversations.refresh;
  useInboxEvents(refreshConversations);
  useEffect(() => {
    if (id)
      void api(`/conversations/${id}/read`, { method: "POST" })
        .then(() => refreshConversations())
        .catch(() => undefined);
  }, [id, refreshConversations]);
  useEffect(() => {
    void api("/inbox/agents/me/heartbeat", {
      method: "POST",
      body: JSON.stringify({ status: "ONLINE" }),
    }).catch(() => undefined);
    const timer = window.setInterval(
      () =>
        void api("/inbox/agents/me/heartbeat", {
          method: "POST",
          body: JSON.stringify({ status: document.hidden ? "AWAY" : "ONLINE" }),
        }).catch(() => undefined),
      30000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const rows = listOf(conversations.data);

  const send = async () => {
    if (!id) return;
    const options = interactiveOptions
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter(([optionId, title]) => optionId && title);
    const interactive =
      mode === "INTERACTIVE_BUTTON"
        ? {
            type: "BUTTON",
            body: interactiveBody,
            buttons: options.map(([optionId, title]) => ({
              id: optionId,
              title,
            })),
          }
        : {
            type: "LIST",
            body: interactiveBody,
            buttonText: "Choose",
            sections: [
              {
                rows: options.map(([optionId, title, description]) => ({
                  id: optionId,
                  title,
                  ...(description ? { description } : {}),
                })),
              },
            ],
          };
    const result = await action.run(
      () =>
        api(`/conversations/${id}/messages`, {
          method: "POST",
          body: JSON.stringify(
            mode === "TEXT"
              ? {
                  type: "TEXT",
                  text: draft,
                  idempotencyKey: crypto.randomUUID(),
                }
              : mode === "TEMPLATE"
                ? {
                    type: "TEMPLATE",
                    templateId,
                    language: "en",
                    parameters: {},
                    idempotencyKey: crypto.randomUUID(),
                  }
                : mode.startsWith("INTERACTIVE_")
                  ? {
                      type: "INTERACTIVE",
                      interactive,
                      idempotencyKey: crypto.randomUUID(),
                    }
                  : {
                      type: mode,
                      mediaObjectKey: media?.objectKey,
                      mediaMimeType: media?.mimeType,
                      mediaFileName: media?.fileName,
                      idempotencyKey: crypto.randomUUID(),
                    },
          ),
        }),
      "Reply queued for delivery.",
    );
    if (result) {
      setDraft("");
      setInteractiveBody("");
      setMedia(null);
      setMode("TEXT");
      await messages.refresh();
    }
  };

  const addNote = async () => {
    if (!id) return;
    const result = await action.run(
      () =>
        api(`/conversations/${id}/notes`, {
          method: "POST",
          body: JSON.stringify({ body: note }),
        }),
      "Internal note added.",
    );
    if (result) {
      setNote("");
      await notes.refresh();
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Team communication"
        title="Shared inbox"
        description="Handle customer conversations together, with tenant-isolated live updates."
        actions={
          <button
            className="secondary-button"
            onClick={() => void conversations.refresh()}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <div className="inbox-shell">
        <section className="inbox-list" aria-label="Conversations">
          <div className="inbox-filters">
            <label>
              <Search />
              <input
                aria-label="Search conversations"
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Conversation status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option>OPEN</option>
              <option>PENDING</option>
              <option>RESOLVED</option>
              <option>CLOSED</option>
            </select>
            <select
              aria-label="Assigned agent filter"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <option value="">All agents</option>
              {(agents.data ?? []).map((agent) => (
                <option key={text(agent.id)} value={text(agent.id)}>
                  {text(agent.full_name)}
                </option>
              ))}
            </select>
            <select
              aria-label="Label filter"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
            >
              <option value="">All labels</option>
              {(labels.data ?? []).map((label) => (
                <option key={text(label.id)} value={text(label.id)}>
                  {text(label.name)}
                </option>
              ))}
            </select>
          </div>
          <DataState
            loading={conversations.loading}
            error={conversations.error}
            empty={!rows.length}
          >
            <div className="conversation-list">
              {rows.map((row) => (
                <button
                  key={text(row.id)}
                  className={id === row.id ? "active" : ""}
                  onClick={() => navigate(`/inbox/${row.id}`)}
                >
                  <span className="avatar">
                    {text(row.full_name, "?").slice(0, 1)}
                  </span>
                  <span>
                    <strong>{text(row.full_name, "Unknown contact")}</strong>
                    <small>
                      {text(row.phone)} · {formatDate(row.last_message_at)}
                    </small>
                  </span>
                  {number(row.unread_count) > 0 && (
                    <b>{formatNumber(row.unread_count)}</b>
                  )}
                </button>
              ))}
            </div>
          </DataState>
        </section>
        <section className="chat-panel" aria-label="Conversation">
          {!id ? (
            <div className="inbox-placeholder">
              <Inbox />
              <h2>Select a conversation</h2>
              <p>Messages and customer context will appear here.</p>
            </div>
          ) : (
            <DataState
              loading={detail.loading || messages.loading}
              error={detail.error || messages.error}
              empty={!detail.data}
            >
              <div className="chat-header">
                <div>
                  <h2>{text(detail.data?.full_name)}</h2>
                  <p>{text(detail.data?.phone_e164)}</p>
                </div>
                <select
                  aria-label="Conversation status"
                  value={text(detail.data?.status, "OPEN")}
                  onChange={(e) =>
                    void action
                      .run(
                        () =>
                          api(`/conversations/${id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              version: detail.data?.version,
                              status: e.target.value,
                            }),
                          }),
                        "Status updated.",
                      )
                      .then(() => detail.refresh())
                  }
                >
                  <option>OPEN</option>
                  <option>PENDING</option>
                  <option>RESOLVED</option>
                  <option>CLOSED</option>
                </select>
                <select
                  aria-label="Priority"
                  value={text(detail.data?.priority, "NORMAL")}
                  onChange={(e) =>
                    void action
                      .run(
                        () =>
                          api(`/conversations/${id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              version: detail.data?.version,
                              priority: e.target.value,
                            }),
                          }),
                        "Priority updated.",
                      )
                      .then(() => detail.refresh())
                  }
                >
                  <option>LOW</option>
                  <option>NORMAL</option>
                  <option>HIGH</option>
                  <option>URGENT</option>
                </select>
              </div>
              <div className="message-history">
                {(messages.data ?? []).map((message) => (
                  <article
                    key={text(message.id)}
                    className={`message-bubble ${message.direction === "OUTBOUND" ? "outbound" : "inbound"}`}
                  >
                    <p>{messagePreview(message)}</p>
                    {!["TEXT", "TEMPLATE", "INTERACTIVE"].includes(
                      text(message.message_type),
                    ) && (
                      <button
                        className="link-button"
                        onClick={() =>
                          void download(
                            `/conversations/${id}/messages/${message.id}/media`,
                            text(message.media_file_name, "attachment"),
                          )
                        }
                      >
                        <Paperclip />
                        Download media
                      </button>
                    )}
                    <small>
                      {formatDate(message.inbound_at ?? message.created_at)} ·{" "}
                      {text(message.status)}
                    </small>
                  </article>
                ))}
              </div>
              {(action.error || action.message) && (
                <Notice success={Boolean(action.message)}>
                  {action.error || action.message}
                </Notice>
              )}
              <div className="composer">
                <div className="composer-tabs">
                  <button
                    className={mode === "TEXT" ? "active" : ""}
                    onClick={() => {
                      setMode("TEXT");
                      setMedia(null);
                    }}
                  >
                    Reply
                  </button>
                  <button
                    className={mode === "TEMPLATE" ? "active" : ""}
                    onClick={() => {
                      setMode("TEMPLATE");
                      setMedia(null);
                    }}
                  >
                    Template
                  </button>
                  <button
                    className={mode === "INTERACTIVE_BUTTON" ? "active" : ""}
                    onClick={() => {
                      setMode("INTERACTIVE_BUTTON");
                      setMedia(null);
                    }}
                  >
                    Buttons
                  </button>
                  <button
                    className={mode === "INTERACTIVE_LIST" ? "active" : ""}
                    onClick={() => {
                      setMode("INTERACTIVE_LIST");
                      setMedia(null);
                    }}
                  >
                    List
                  </button>
                </div>
                {mode === "TEXT" ? (
                  <textarea
                    aria-label="Reply"
                    placeholder="Write a reply…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                ) : mode === "TEMPLATE" ? (
                  <select
                    aria-label="Approved template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">Choose approved template</option>
                    {listOf(templates.data)
                      .filter((x) => x.meta_status === "APPROVED")
                      .map((x) => (
                        <option value={text(x.id)} key={text(x.id)}>
                          {text(x.name)}
                        </option>
                      ))}
                  </select>
                ) : mode.startsWith("INTERACTIVE_") ? (
                  <div className="interactive-composer">
                    <textarea
                      aria-label="Interactive message body"
                      placeholder="Message body"
                      value={interactiveBody}
                      onChange={(e) => setInteractiveBody(e.target.value)}
                    />
                    <textarea
                      aria-label="Interactive options"
                      placeholder={
                        mode === "INTERACTIVE_BUTTON"
                          ? "id|Button title (one per line, up to 3)"
                          : "id|Row title|Description (one per line, up to 10)"
                      }
                      value={interactiveOptions}
                      onChange={(e) => setInteractiveOptions(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="attachment-ready">
                    <Paperclip />
                    <span>
                      <strong>{text(media?.fileName)}</strong>
                      <small>{text(media?.mimeType)}</small>
                    </span>
                  </div>
                )}
                <div>
                  <label className="secondary-button file-button">
                    <Paperclip /> Media
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf,video/mp4"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !id) return;
                        const form = new FormData();
                        form.set("file", file);
                        const uploaded = await action.run(
                          () =>
                            api<ApiRecord>(`/conversations/${id}/media`, {
                              method: "POST",
                              body: form,
                            }),
                          "Media validated and ready to send.",
                        );
                        if (uploaded) {
                          setMedia(uploaded);
                          setMode(
                            file.type === "application/pdf"
                              ? "DOCUMENT"
                              : file.type === "video/mp4"
                                ? "VIDEO"
                                : "IMAGE",
                          );
                        }
                      }}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={
                      action.working ||
                      (mode === "TEXT"
                        ? !draft.trim()
                        : mode === "TEMPLATE"
                          ? !templateId
                          : mode.startsWith("INTERACTIVE_")
                            ? !interactiveBody.trim() ||
                              !interactiveOptions.trim()
                            : !media)
                    }
                    onClick={() => void send()}
                  >
                    <Send /> Send
                  </button>
                </div>
              </div>
            </DataState>
          )}
        </section>
        <aside className="contact-panel" aria-label="Customer profile">
          {!detail.data ? (
            <div className="inbox-placeholder">
              <UserRoundCheck />
              <p>Customer profile</p>
            </div>
          ) : (
            <>
              <h3>Customer profile</h3>
              <dl>
                <dt>Phone</dt>
                <dd>{text(detail.data.phone_e164)}</dd>
                <dt>Consent</dt>
                <dd>{text(detail.data.marketing_consent, "Not granted")}</dd>
                <dt>Last interaction</dt>
                <dd>{formatDate(detail.data.last_message_at)}</dd>
              </dl>
              <h3>Assignment</h3>
              <select
                aria-label="Assigned agent"
                value={text(detail.data.assigned_user_id, "")}
                onChange={async (e) => {
                  const path = e.target.value
                    ? `/conversations/${id}/assign`
                    : `/conversations/${id}/unassign`;
                  const body = e.target.value
                    ? { userId: e.target.value, version: detail.data?.version }
                    : { version: detail.data?.version };
                  if (
                    await action.run(
                      () =>
                        api(path, {
                          method: "POST",
                          body: JSON.stringify(body),
                        }),
                      "Assignment updated.",
                    )
                  )
                    await detail.refresh();
                }}
              >
                <option value="">Unassigned</option>
                {(agents.data ?? []).map((agent) => (
                  <option key={text(agent.id)} value={text(agent.id)}>
                    {text(agent.full_name)} · {text(agent.presence)}
                  </option>
                ))}
              </select>
              <h3>Labels</h3>
              <div className="chip-row">
                {(labels.data ?? []).map((label) => {
                  const selected = listOf(detail.data?.labels).some(
                    (item) => item.id === label.id,
                  );
                  return (
                    <button
                      className={`chip ${selected ? "selected" : ""}`}
                      key={text(label.id)}
                      onClick={async () => {
                        const ids = listOf(detail.data?.labels).map((item) =>
                          text(item.id),
                        );
                        const next = selected
                          ? ids.filter((value) => value !== label.id)
                          : [...ids, text(label.id)];
                        if (
                          await action.run(
                            () =>
                              api(`/conversations/${id}/labels`, {
                                method: "POST",
                                body: JSON.stringify({ labelIds: next }),
                              }),
                            "Labels updated.",
                          )
                        )
                          await detail.refresh();
                      }}
                    >
                      <Tag />
                      {text(label.name)}
                    </button>
                  );
                })}
              </div>
              <h3>Internal notes</h3>
              <div className="notes-list">
                {(notes.data ?? []).map((item) => (
                  <article key={text(item.id)}>
                    <p>{text(item.body)}</p>
                    <small>
                      {text(item.author_name)} · {formatDate(item.created_at)}
                    </small>
                  </article>
                ))}
              </div>
              <textarea
                aria-label="Internal note"
                placeholder="Private note for your team"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="secondary-button"
                disabled={!note.trim() || action.working}
                onClick={() => void addNote()}
              >
                <MessageSquareText /> Add note
              </button>
              <p className="privacy-hint">
                Notes are never sent to the customer.
              </p>
              <h3>Recent activity</h3>
              <div className="notes-list">
                {(activity.data ?? []).slice(0, 8).map((item) => (
                  <article key={text(item.id)}>
                    <p>{text(item.event_type).replaceAll(".", " ")}</p>
                    <small>
                      {text(item.actor_name, "System")} ·{" "}
                      {formatDate(item.created_at)}
                    </small>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

export function TeamInboxPage() {
  const agents = useApi<ApiRecord[]>("/inbox/agents");
  const action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="Team inbox"
        title="Assignments & availability"
        description="See current agent presence and active workload."
        actions={
          <select
            aria-label="My availability"
            defaultValue="ONLINE"
            onChange={async (e) => {
              await action.run(
                () =>
                  api("/inbox/agents/me/availability", {
                    method: "PATCH",
                    body: JSON.stringify({ status: e.target.value }),
                  }),
                "Availability updated.",
              );
              await agents.refresh();
            }}
          >
            <option>ONLINE</option>
            <option>AWAY</option>
            <option>BUSY</option>
            <option>OFFLINE</option>
          </select>
        }
      />
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <section className="card">
        <DataState
          loading={agents.loading}
          error={agents.error}
          empty={!agents.data?.length}
        >
          <SimpleTable
            rows={agents.data ?? []}
            columns={[
              { key: "full_name", label: "Agent" },
              {
                key: "presence",
                label: "Live presence",
                render: (r) => <Status value={r.presence} />,
              },
              {
                key: "preferred_status",
                label: "Preference",
                render: (r) => <Status value={r.preferred_status} />,
              },
              { key: "workload", label: "Active conversations" },
            ]}
          />
        </DataState>
      </section>
    </>
  );
}

export function InboxConfigurationPage() {
  const replies = useApi<ApiRecord[]>("/inbox/saved-replies");
  const labels = useApi<ApiRecord[]>("/inbox/labels");
  const action = useAction();
  const [reply, setReply] = useState({
    name: "",
    shortcut: "/",
    content: "",
    language: "en",
  });
  const [label, setLabel] = useState({ name: "", color: "#0c8f62" });
  return (
    <>
      <PageHeader
        eyebrow="Inbox tools"
        title="Saved replies & labels"
        description="Create reusable team content without treating it as an approved Meta template."
      />
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <div className="two-column">
        <section className="card">
          <h2>Saved replies</h2>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action.run(
                  () =>
                    api("/inbox/saved-replies", {
                      method: "POST",
                      body: JSON.stringify(reply),
                    }),
                  "Saved reply created.",
                )
              ) {
                setReply({
                  name: "",
                  shortcut: "/",
                  content: "",
                  language: "en",
                });
                await replies.refresh();
              }
            }}
          >
            <label>
              Name
              <input
                required
                value={reply.name}
                onChange={(e) => setReply({ ...reply, name: e.target.value })}
              />
            </label>
            <label>
              Shortcut
              <input
                required
                pattern="/[a-z0-9_-]+"
                value={reply.shortcut}
                onChange={(e) =>
                  setReply({ ...reply, shortcut: e.target.value })
                }
              />
            </label>
            <label className="full-field">
              Content
              <textarea
                required
                value={reply.content}
                onChange={(e) =>
                  setReply({ ...reply, content: e.target.value })
                }
              />
            </label>
            <button className="primary-button" disabled={action.working}>
              Save reply
            </button>
          </form>
          <DataState
            loading={replies.loading}
            error={replies.error}
            empty={!replies.data?.length}
          >
            <SimpleTable
              rows={replies.data ?? []}
              columns={[
                { key: "name", label: "Name" },
                { key: "shortcut", label: "Shortcut" },
                { key: "language", label: "Language" },
                { key: "content", label: "Content" },
              ]}
            />
          </DataState>
        </section>
        <section className="card">
          <h2>Conversation labels</h2>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action.run(
                  () =>
                    api("/inbox/labels", {
                      method: "POST",
                      body: JSON.stringify(label),
                    }),
                  "Label created.",
                )
              ) {
                setLabel({ name: "", color: "#0c8f62" });
                await labels.refresh();
              }
            }}
          >
            <input
              aria-label="Label name"
              required
              placeholder="Label name"
              value={label.name}
              onChange={(e) => setLabel({ ...label, name: e.target.value })}
            />
            <input
              aria-label="Label color"
              type="color"
              value={label.color}
              onChange={(e) => setLabel({ ...label, color: e.target.value })}
            />
            <button className="primary-button">Add</button>
          </form>
          <DataState
            loading={labels.loading}
            error={labels.error}
            empty={!labels.data?.length}
          >
            <div className="label-grid">
              {(labels.data ?? []).map((item) => (
                <span
                  className="label-item"
                  style={{ borderColor: text(item.color) }}
                  key={text(item.id)}
                >
                  <i style={{ background: text(item.color) }} />
                  {text(item.name)}
                </span>
              ))}
            </div>
          </DataState>
        </section>
      </div>
    </>
  );
}

export function InboxAnalyticsPage() {
  const result = useApi<ApiRecord>("/inbox/analytics");
  const metrics = useMemo(
    () => [
      { label: "Open", value: result.data?.open, icon: Inbox },
      { label: "Pending", value: result.data?.pending, icon: Clock3 },
      { label: "Resolved", value: result.data?.resolved, icon: CheckCircle2 },
      { label: "Unassigned", value: result.data?.unassigned, icon: UsersRound },
    ],
    [result.data],
  );
  return (
    <>
      <PageHeader
        eyebrow="Support analytics"
        title="Inbox performance"
        description="Operational metrics calculated from persisted conversation activity."
      />
      <DataState
        loading={result.loading}
        error={result.error}
        empty={!result.data}
      >
        <>
          <div className="metric-grid">
            {metrics.map(({ label, value }) => (
              <Metric key={label} label={label} value={formatNumber(value)} />
            ))}
          </div>
          <div className="two-column">
            <section className="card">
              <BarChart3 />
              <h2>Average first response</h2>
              <strong className="large-number">
                {formatNumber(result.data?.avg_first_response_seconds)}s
              </strong>
              <p>Time from latest inbound message to agent response.</p>
            </section>
            <section className="card">
              <Clock3 />
              <h2>Average resolution</h2>
              <strong className="large-number">
                {formatNumber(result.data?.avg_resolution_seconds)}s
              </strong>
              <p>Time from conversation creation to resolution.</p>
            </section>
          </div>
        </>
      </DataState>
    </>
  );
}

export function InboxSettingsPage() {
  const result = useApi<ApiRecord>("/inbox/settings");
  return (
    <>
      <PageHeader
        eyebrow="Inbox configuration"
        title="Inbox settings"
        description="Configure notification and retention defaults. Routing remains manual in Phase 6."
      />
      <section className="card narrow-card">
        <DataState loading={result.loading} error={result.error} empty={false}>
          {result.data && (
            <InboxSettingsForm
              key={JSON.stringify(result.data)}
              initial={result.data}
            />
          )}
        </DataState>
      </section>
    </>
  );
}

function InboxSettingsForm({ initial }: { initial: ApiRecord }) {
  const action = useAction();
  const [retention, setRetention] = useState(
    number(initial.retention_days) || 1095,
  );
  const [notifications, setNotifications] = useState(
    initial.notifications_enabled !== false,
  );
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await action.run(
          () =>
            api("/inbox/settings", {
              method: "PATCH",
              body: JSON.stringify({
                notificationsEnabled: notifications,
                retentionDays: retention,
              }),
            }),
          "Inbox settings saved.",
        );
      }}
    >
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={notifications}
          onChange={(e) => setNotifications(e.target.checked)}
        />
        <span>
          <strong>New-message notifications</strong>
          <small>Notify agents when durable inbound events arrive.</small>
        </span>
      </label>
      <label>
        Retention days
        <input
          type="number"
          min="30"
          max="2555"
          value={retention}
          onChange={(e) => setRetention(Number(e.target.value))}
        />
      </label>
      <label>
        Routing mode
        <input disabled value="Manual assignment" />
      </label>
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <button className="primary-button" disabled={action.working}>
        <Settings2 />
        Save settings
      </button>
    </form>
  );
}

export function AdminInboxHealthPage() {
  const result = useApi<ApiRecord[]>("/internal/admin/v1/inbox/health");
  const rows = result.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Inbox service health"
        description="Aggregate operational diagnostics without exposing customer conversation content."
      />
      <DataState
        loading={result.loading}
        error={result.error}
        empty={!rows.length}
      >
        <>
          <div className="metric-grid">
            <Metric label="Tenant inboxes" value={formatNumber(rows.length)} />
            <Metric
              label="Active conversations"
              value={formatNumber(
                rows.reduce(
                  (sum, row) => sum + number(row.active_conversations),
                  0,
                ),
              )}
            />
            <Metric
              label="Unassigned"
              value={formatNumber(
                rows.reduce((sum, row) => sum + number(row.unassigned), 0),
              )}
            />
            <Metric
              label="Webhook failures · 24h"
              value={formatNumber(
                rows.reduce(
                  (sum, row) => sum + number(row.webhook_failures_24h),
                  0,
                ),
              )}
            />
          </div>
          <section className="card">
            <h2>Tenant inbox diagnostics</h2>
            <SimpleTable
              rows={rows}
              columns={[
                { key: "name", label: "Customer" },
                { key: "active_conversations", label: "Active" },
                { key: "unassigned", label: "Unassigned" },
                { key: "inbound_24h", label: "Inbound · 24h" },
                { key: "webhook_failures_24h", label: "Webhook failures" },
                {
                  key: "last_message_at",
                  label: "Last activity",
                  render: (r) => formatDate(r.last_message_at),
                },
              ]}
            />
          </section>
        </>
      </DataState>
    </>
  );
}
