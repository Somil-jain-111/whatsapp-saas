import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CirclePlay,
  Copy,
  GitBranch,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, formatNumber, listOf, number, text } from "./api";
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

const nodeTypes = [
  "TRIGGER",
  "CONDITION",
  "SEND_TEMPLATE",
  "SEND_SESSION_MESSAGE",
  "SEND_INTERACTIVE",
  "WAIT",
  "UPDATE_CONTACT",
  "ADD_TAG",
  "REMOVE_TAG",
  "ASSIGN_AGENT",
  "HTTP_REQUEST",
  "WEBHOOK",
  "END",
];
type Node = {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};
type Edge = { id: string; source: string; target: string; branch?: string };

export function AutomationDashboardPage() {
  const analytics = useApi<ApiRecord>("/automations/analytics"),
    workflows = useApi<ApiRecord>("/workflows?limit=5");
  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Automation dashboard"
        description="Build and monitor durable WhatsApp workflows."
        actions={
          <Link className="primary-button" to="/automations/new">
            <Plus />
            Create workflow
          </Link>
        }
      />
      <DataState
        loading={analytics.loading}
        error={analytics.error}
        empty={false}
      >
        <div className="metric-grid">
          <Metric
            label="Executions"
            value={formatNumber(analytics.data?.executions)}
          />
          <Metric
            label="Completed"
            value={formatNumber(analytics.data?.completed)}
            tone="green"
          />
          <Metric
            label="Failed"
            value={formatNumber(analytics.data?.failed)}
            tone="amber"
          />
          <Metric
            label="Average duration"
            value={`${formatNumber(analytics.data?.avg_duration_seconds)}s`}
          />
        </div>
      </DataState>
      <section className="card">
        <h2>Recent workflows</h2>
        <DataState
          loading={workflows.loading}
          error={workflows.error}
          empty={!listOf(workflows.data).length}
        >
          <WorkflowTable rows={listOf(workflows.data)} />
        </DataState>
      </section>
    </>
  );
}

function WorkflowTable({ rows }: { rows: ApiRecord[] }) {
  return (
    <SimpleTable
      rows={rows}
      columns={[
        {
          key: "name",
          label: "Workflow",
          render: (r) => (
            <Link className="table-link" to={`/automations/${r.id}/builder`}>
              {text(r.name)}
            </Link>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Status value={r.status} />,
        },
        { key: "published_version", label: "Published version" },
        {
          key: "updated_at",
          label: "Updated",
          render: (r) => formatDate(r.updated_at),
        },
      ]}
    />
  );
}

export function WorkflowListPage() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const result = useApi<ApiRecord>(
      `/workflows?limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`,
    ),
    action = useAction(),
    navigate = useNavigate();
  const create = async () => {
    const name = window.prompt("Workflow name");
    if (!name) return;
    const row = await action.run(
      () =>
        api<ApiRecord>("/workflows", {
          method: "POST",
          body: JSON.stringify({ name }),
        }),
      "Workflow created.",
    );
    if (row) navigate(`/automations/${row.id}/builder`);
  };
  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="Draft, publish, activate and pause versioned workflows."
        actions={
          <button className="primary-button" onClick={() => void create()}>
            <Plus />
            Create
          </button>
        }
      />
      <div className="toolbar">
        <input
          placeholder="Search workflows"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>DRAFT</option>
          <option>PUBLISHED</option>
          <option>ACTIVE</option>
          <option>PAUSED</option>
          <option>ARCHIVED</option>
        </select>
      </div>
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <section className="card">
        <DataState
          loading={result.loading}
          error={result.error}
          empty={!listOf(result.data).length}
        >
          <>
            <WorkflowTable rows={listOf(result.data)} />
            <div className="workflow-actions">
              {listOf(result.data).map((row) => (
                <div key={text(row.id)}>
                  <strong>{text(row.name)}</strong>
                  <button
                    onClick={() =>
                      void action
                        .run(
                          () =>
                            api(`/workflows/${row.id}/duplicate`, {
                              method: "POST",
                            }),
                          "Workflow duplicated.",
                        )
                        .then(() => result.refresh())
                    }
                  >
                    <Copy />
                    Duplicate
                  </button>
                  {row.status === "ACTIVE" ? (
                    <button
                      onClick={() =>
                        void action
                          .run(
                            () =>
                              api(`/workflows/${row.id}/pause`, {
                                method: "POST",
                              }),
                            "Workflow paused.",
                          )
                          .then(() => result.refresh())
                      }
                    >
                      <Pause />
                      Pause
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={!row.published_version}
                        onClick={() =>
                          void action
                            .run(
                              () =>
                                api(`/workflows/${row.id}/activate`, {
                                  method: "POST",
                                }),
                              "Workflow activated.",
                            )
                            .then(() => result.refresh())
                        }
                      >
                        <Play />
                        Activate
                      </button>
                      <button
                        className="danger-button"
                        onClick={() =>
                          void action
                            .run(
                              () =>
                                api(`/workflows/${row.id}`, {
                                  method: "DELETE",
                                }),
                              "Workflow archived.",
                            )
                            .then(() => result.refresh())
                        }
                      >
                        <Trash2 />
                        Archive
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        </DataState>
      </section>
    </>
  );
}

export function WorkflowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const result = useApi<ApiRecord>(
    id && id !== "new" ? `/workflows/${id}` : null,
  );
  const versions = useApi<ApiRecord[]>(
    id && id !== "new" ? `/workflows/${id}/versions` : null,
  );
  const action = useAction();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [trigger, setTrigger] = useState<Record<string, unknown>>({
    eventType: "INCOMING_MESSAGE",
  });
  const [selected, setSelected] = useState("");
  const [configDraft, setConfigDraft] = useState("{}");
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>(
    [],
  );
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!result.data) return;
    // oxlint-disable-next-line react/set-state-in-effect -- fetched drafts hydrate the editor.
    setNodes((result.data.draft_nodes as Node[]) ?? []);
    setEdges((result.data.draft_edges as Edge[]) ?? []);
    setTrigger(
      (result.data.trigger_config as Record<string, unknown>) ?? {
        eventType: "INCOMING_MESSAGE",
      },
    );
  }, [result.data]);

  useEffect(() => {
    if (id !== "new") return;
    void api<ApiRecord>("/workflows", {
      method: "POST",
      body: JSON.stringify({ name: "Untitled workflow" }),
    }).then((row) =>
      navigate(`/automations/${row.id}/builder`, { replace: true }),
    );
  }, [id, navigate]);

  const selectedNode = nodes.find((node) => node.id === selected);
  const commit = (nextNodes: Node[], nextEdges: Edge[]) => {
    setHistory([...history, { nodes, edges }].slice(-50));
    setFuture([]);
    setNodes(nextNodes);
    setEdges(nextEdges);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture([{ nodes, edges }, ...future].slice(0, 50));
    setHistory(history.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory([...history, { nodes, edges }].slice(-50));
    setFuture(future.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
  };
  const selectNode = (node: Node) => {
    setSelected(node.id);
    setConfigDraft(JSON.stringify(node.config, null, 2));
  };
  const add = (type: string) => {
    const node: Node = {
      id: `${type.toLowerCase()}_${crypto.randomUUID().slice(0, 6)}`,
      type,
      position: {
        x: 80 + (nodes.length % 3) * 190,
        y: 80 + Math.floor(nodes.length / 3) * 120,
      },
      config:
        type === "WAIT"
          ? { durationSeconds: 60 }
          : type === "CONDITION"
            ? { path: "event.text", operator: "CONTAINS", value: "help" }
            : type === "SEND_INTERACTIVE"
              ? {
                  interactive: {
                    type: "BUTTON",
                    body: "How can we help?",
                    buttons: [{ id: "support", title: "Support" }],
                  },
                }
              : {},
    };
    commit([...nodes, node], edges);
    selectNode(node);
  };
  const save = () =>
    action
      .run(
        () =>
          api(`/workflows/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              revision: result.data?.revision,
              triggerConfig: trigger,
              nodes,
              edges,
            }),
          }),
        "Draft saved.",
      )
      .then(() => result.refresh());
  const applyConfig = () => {
    if (!selectedNode) return;
    try {
      const config = JSON.parse(configDraft) as Record<string, unknown>;
      commit(
        nodes.map((node) =>
          node.id === selected ? { ...node, config } : node,
        ),
        edges,
      );
    } catch {
      window.alert("Node configuration must be valid JSON.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Visual builder"
        title={text(result.data?.name, "Loading workflow…")}
        description="Drag nodes, connect them, validate the graph and publish an immutable version."
        actions={
          <>
            <button
              className="secondary-button"
              onClick={() =>
                void action.run(
                  () => api(`/workflows/${id}/validate`, { method: "POST" }),
                  "Workflow is valid.",
                )
              }
            >
              <CirclePlay />
              Validate
            </button>
            <button className="secondary-button" onClick={() => void save()}>
              <Save />
              Save draft
            </button>
            <button
              className="secondary-button"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 />
              Undo
            </button>
            <button
              className="secondary-button"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 />
              Redo
            </button>
            <button
              className="primary-button"
              onClick={() =>
                void save()
                  .then(() =>
                    action.run(
                      () => api(`/workflows/${id}/publish`, { method: "POST" }),
                      "Workflow published.",
                    ),
                  )
                  .then(() => versions.refresh())
              }
            >
              <Sparkles />
              Publish
            </button>
            <div
              className="canvas-controls"
              aria-label="Canvas zoom and pan controls"
            >
              <button
                aria-label="Zoom out"
                disabled={zoom <= 0.5}
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                <ZoomOut />
              </button>
              <button aria-label="Reset zoom" onClick={() => setZoom(1)}>
                <LocateFixed />
                {Math.round(zoom * 100)}%
              </button>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 1.5}
                onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
              >
                <ZoomIn />
              </button>
              <button
                aria-label="Pan left"
                onClick={() =>
                  canvas.current?.scrollBy({ left: -180, behavior: "smooth" })
                }
              >
                <ArrowLeft />
              </button>
              <button
                aria-label="Pan up"
                onClick={() =>
                  canvas.current?.scrollBy({ top: -140, behavior: "smooth" })
                }
              >
                <ArrowUp />
              </button>
              <button
                aria-label="Pan down"
                onClick={() =>
                  canvas.current?.scrollBy({ top: 140, behavior: "smooth" })
                }
              >
                <ArrowDown />
              </button>
              <button
                aria-label="Pan right"
                onClick={() =>
                  canvas.current?.scrollBy({ left: 180, behavior: "smooth" })
                }
              >
                <ArrowRight />
              </button>
            </div>
          </>
        }
      />
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <div className="builder-shell">
        <aside className="node-palette">
          <h3>Nodes</h3>
          {nodeTypes.map((type) => (
            <button key={type} onClick={() => add(type)}>
              <Plus />
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </aside>
        <section className="workflow-canvas" ref={canvas}>
          <div
            className="workflow-stage"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg className="workflow-edges" aria-hidden="true">
              {edges.map((edge) => {
                const source = nodes.find((node) => node.id === edge.source);
                const target = nodes.find((node) => node.id === edge.target);
                return source && target ? (
                  <line
                    key={edge.id}
                    x1={source.position.x + 82}
                    y1={source.position.y + 38}
                    x2={target.position.x + 82}
                    y2={target.position.y + 38}
                  />
                ) : null;
              })}
            </svg>
            {nodes.map((node) => (
              <button
                key={node.id}
                className={`workflow-node ${selected === node.id ? "selected" : ""}`}
                style={{ left: node.position.x, top: node.position.y }}
                draggable
                onDragEnd={(event) => {
                  const bounds =
                    event.currentTarget.parentElement?.getBoundingClientRect();
                  if (!bounds) return;
                  commit(
                    nodes.map((item) =>
                      item.id === node.id
                        ? {
                            ...item,
                            position: {
                              x: Math.max(
                                0,
                                (event.clientX - bounds.left) / zoom,
                              ),
                              y: Math.max(
                                0,
                                (event.clientY - bounds.top) / zoom,
                              ),
                            },
                          }
                        : item,
                    ),
                    edges,
                  );
                }}
                onClick={() => selectNode(node)}
              >
                <GitBranch />
                <strong>{node.type.replaceAll("_", " ")}</strong>
                <small>{node.id}</small>
              </button>
            ))}
          </div>
        </section>
        <aside className="node-config">
          <h3>Configuration</h3>
          <label>
            Trigger event
            <select
              value={text(trigger.eventType, "INCOMING_MESSAGE")}
              onChange={(event) =>
                setTrigger({ ...trigger, eventType: event.target.value })
              }
            >
              <option>INCOMING_MESSAGE</option>
              <option>CONTACT_CREATED</option>
              <option>CONTACT_TAG_ADDED</option>
              <option>MESSAGE_DELIVERED</option>
              <option>MESSAGE_FAILED</option>
              <option>CONVERSATION_OPENED</option>
              <option>CONVERSATION_RESOLVED</option>
              <option>EXTERNAL_API_EVENT</option>
              <option>SCHEDULED</option>
            </select>
          </label>
          {trigger.eventType === "SCHEDULED" && (
            <>
              <label>
                Scheduled time
                <input
                  type="datetime-local"
                  value={
                    typeof trigger.scheduledAt === "string"
                      ? trigger.scheduledAt.slice(0, 16)
                      : ""
                  }
                  onChange={(event) =>
                    setTrigger({
                      ...trigger,
                      scheduledAt: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : "",
                    })
                  }
                />
              </label>
              <label>
                IANA timezone
                <input
                  value={text(
                    trigger.timezone,
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                  )}
                  onChange={(event) =>
                    setTrigger({ ...trigger, timezone: event.target.value })
                  }
                  placeholder="Asia/Kolkata"
                />
              </label>
            </>
          )}
          {selectedNode ? (
            <>
              <label>
                Node JSON
                <textarea
                  value={configDraft}
                  onChange={(event) => setConfigDraft(event.target.value)}
                  onBlur={applyConfig}
                />
              </label>
              <label>
                Connect to
                <select
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const branch =
                      selectedNode.type === "CONDITION"
                        ? edges.some(
                            (edge) =>
                              edge.source === selected &&
                              edge.branch === "true",
                          )
                          ? "false"
                          : "true"
                        : undefined;
                    commit(nodes, [
                      ...edges,
                      {
                        id: crypto.randomUUID(),
                        source: selected,
                        target: event.target.value,
                        ...(branch ? { branch } : {}),
                      },
                    ]);
                  }}
                >
                  <option value="">Choose node</option>
                  {nodes
                    .filter((node) => node.id !== selected)
                    .map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.id}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="danger-button"
                onClick={() => {
                  commit(
                    nodes.filter((node) => node.id !== selected),
                    edges.filter(
                      (edge) =>
                        edge.source !== selected && edge.target !== selected,
                    ),
                  );
                  setSelected("");
                }}
              >
                <Trash2 />
                Delete node
              </button>
            </>
          ) : (
            <p>Select a node to edit it.</p>
          )}
          <h3>Connections</h3>
          {edges.map((edge) => (
            <button
              className="edge-row"
              key={edge.id}
              onClick={() =>
                commit(
                  nodes,
                  edges.filter((item) => item.id !== edge.id),
                )
              }
            >
              {edge.source} → {edge.target} {edge.branch && `(${edge.branch})`}{" "}
              ×
            </button>
          ))}
          <h3>Versions</h3>
          {(versions.data ?? []).map((version) => (
            <small key={text(version.id)}>
              v{String(version.version)} · {formatDate(version.published_at)}
            </small>
          ))}
        </aside>
      </div>
    </>
  );
}

export function ChatbotRulesPage() {
  const result = useApi<ApiRecord[]>("/chatbot/rules"),
    action = useAction();
  const [form, setForm] = useState({
    name: "Greeting",
    matchType: "NORMALIZED",
    keywords: "hi,hello",
    responseType: "SESSION_MESSAGE",
    text: "Welcome! How can we help?",
    targetId: "",
    language: "en",
    interactiveJson:
      '{"type":"BUTTON","body":"How can we help?","buttons":[{"id":"support","title":"Support"}]}',
    priority: 100,
    isFallback: false,
    active: true,
  });
  const save = async () => {
    let interactive: unknown;
    try {
      interactive = JSON.parse(form.interactiveJson);
    } catch {
      window.alert("Interactive response must be valid JSON.");
      return;
    }
    if (
      await action.run(
        () =>
          api("/chatbot/rules", {
            method: "POST",
            body: JSON.stringify({
              name: form.name,
              matchType: form.matchType,
              keywords: form.keywords
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              responseType: form.responseType,
              responseConfig:
                form.responseType === "SESSION_MESSAGE"
                  ? { text: form.text }
                  : form.responseType === "TEMPLATE"
                    ? {
                        templateId: form.targetId,
                        language: form.language,
                        parameters: {},
                      }
                    : form.responseType === "INTERACTIVE"
                      ? { interactive }
                      : { agentId: form.targetId },
              priority: form.priority,
              isFallback: form.isFallback,
              active: form.active,
            }),
          }),
        "Chatbot rule created.",
      )
    )
      await result.refresh();
  };
  return (
    <>
      <PageHeader
        eyebrow="Rule-based chatbot"
        title="Chatbot rules"
        description="Configure deterministic keyword replies and agent handoff without AI-generated content."
      />
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <div className="two-column">
        <section className="card">
          <h2>New rule</h2>
          <div className="form-grid">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Match
              <select
                value={form.matchType}
                onChange={(e) =>
                  setForm({ ...form, matchType: e.target.value })
                }
              >
                <option>EXACT</option>
                <option>NORMALIZED</option>
                <option>CONTAINS</option>
              </select>
            </label>
            <label className="full-field">
              Keywords
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              />
            </label>
            <label>
              Response
              <select
                value={form.responseType}
                onChange={(e) =>
                  setForm({ ...form, responseType: e.target.value })
                }
              >
                <option>SESSION_MESSAGE</option>
                <option>TEMPLATE</option>
                <option>INTERACTIVE</option>
                <option>AGENT_HANDOFF</option>
              </select>
            </label>
            <label>
              Priority
              <input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />
            </label>
            {form.responseType === "SESSION_MESSAGE" ? (
              <label className="full-field">
                Response text
                <textarea
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                />
              </label>
            ) : form.responseType === "INTERACTIVE" ? (
              <label className="full-field">
                Interactive message JSON
                <textarea
                  value={form.interactiveJson}
                  onChange={(e) =>
                    setForm({ ...form, interactiveJson: e.target.value })
                  }
                />
              </label>
            ) : (
              <label className="full-field">
                {form.responseType === "TEMPLATE" ? "Template ID" : "Agent ID"}
                <input
                  value={form.targetId}
                  onChange={(e) =>
                    setForm({ ...form, targetId: e.target.value })
                  }
                />
              </label>
            )}
            {form.responseType === "TEMPLATE" && (
              <label>
                Language
                <input
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                />
              </label>
            )}
            <button className="primary-button" onClick={() => void save()}>
              <Bot />
              Create rule
            </button>
          </div>
        </section>
        <section className="card">
          <DataState
            loading={result.loading}
            error={result.error}
            empty={!result.data?.length}
          >
            <SimpleTable
              rows={result.data ?? []}
              columns={[
                { key: "name", label: "Rule" },
                { key: "match_type", label: "Match" },
                {
                  key: "keywords",
                  label: "Keywords",
                  render: (r) =>
                    Array.isArray(r.keywords) ? r.keywords.join(", ") : "—",
                },
                { key: "response_type", label: "Response" },
                {
                  key: "active",
                  label: "Status",
                  render: (r) => (
                    <Status value={r.active ? "ACTIVE" : "DISABLED"} />
                  ),
                },
              ]}
            />
          </DataState>
        </section>
      </div>
    </>
  );
}

export function WorkflowExecutionsPage() {
  const workflows = useApi<ApiRecord>("/workflows?limit=100"),
    [workflow, setWorkflow] = useState(""),
    result = useApi<ApiRecord>(
      workflow ? `/workflows/${workflow}/executions?limit=50` : null,
    ),
    action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="Execution monitoring"
        title="Workflow execution logs"
        description="Inspect durable execution status, failure reasons and retry eligible runs."
      />
      <div className="toolbar">
        <select value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
          <option value="">Select workflow</option>
          {listOf(workflows.data).map((row) => (
            <option key={text(row.id)} value={text(row.id)}>
              {text(row.name)}
            </option>
          ))}
        </select>
      </div>
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <section className="card">
        <DataState
          loading={result.loading}
          error={result.error}
          empty={!listOf(result.data).length}
        >
          <SimpleTable
            rows={listOf(result.data)}
            columns={[
              {
                key: "id",
                label: "Execution",
                render: (r) => (
                  <Link
                    className="table-link"
                    to={`/automations/executions/${r.id}`}
                  >
                    {text(r.id).slice(0, 8)}
                  </Link>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Status value={r.status} />,
              },
              { key: "version", label: "Version" },
              { key: "step_count", label: "Steps" },
              { key: "failure_reason", label: "Failure" },
              {
                key: "updated_at",
                label: "Updated",
                render: (r) => formatDate(r.updated_at),
              },
            ]}
          />
        </DataState>
      </section>
    </>
  );
}

export function ExecutionDetailPage() {
  const { id } = useParams(),
    execution = useApi<ApiRecord>(`/workflow-executions/${id}`),
    steps = useApi<ApiRecord[]>(`/workflow-executions/${id}/steps`),
    action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="Execution trace"
        title={`Execution ${id?.slice(0, 8)}`}
        description="Step-by-step inputs, outputs and bounded retry diagnostics."
        actions={
          <>
            {execution.data?.status === "FAILED" && (
              <button
                className="primary-button"
                onClick={() =>
                  void action.run(
                    () =>
                      api(`/workflow-executions/${id}/retry`, {
                        method: "POST",
                      }),
                    "Execution queued for retry.",
                  )
                }
              >
                <Play />
                Retry
              </button>
            )}
            {["PENDING", "RUNNING", "WAITING"].includes(
              text(execution.data?.status, ""),
            ) && (
              <button
                className="danger-button"
                onClick={() =>
                  void action.run(
                    () =>
                      api(`/workflow-executions/${id}/cancel`, {
                        method: "POST",
                      }),
                    "Execution cancelled.",
                  )
                }
              >
                <Pause />
                Cancel
              </button>
            )}
          </>
        }
      />
      {(action.error || action.message) && (
        <Notice success={Boolean(action.message)}>
          {action.error || action.message}
        </Notice>
      )}
      <section className="card">
        <DataState
          loading={steps.loading}
          error={steps.error}
          empty={!steps.data?.length}
        >
          <SimpleTable
            rows={steps.data ?? []}
            columns={[
              { key: "node_id", label: "Node" },
              { key: "node_type", label: "Type" },
              {
                key: "status",
                label: "Status",
                render: (r) => <Status value={r.status} />,
              },
              { key: "attempt_count", label: "Attempts" },
              { key: "error_message", label: "Error" },
              {
                key: "started_at",
                label: "Started",
                render: (r) => formatDate(r.started_at),
              },
            ]}
          />
        </DataState>
      </section>
    </>
  );
}

export function AutomationAnalyticsPage() {
  const result = useApi<ApiRecord>("/automations/analytics");
  const success = number(result.data?.executions)
    ? Math.round(
        (number(result.data?.completed) / number(result.data?.executions)) *
          100,
      )
    : 0;
  return (
    <>
      <PageHeader
        eyebrow="Automation analytics"
        title="Workflow performance"
        description="Execution success, failure and duration metrics from durable workflow state."
      />
      <DataState loading={result.loading} error={result.error} empty={false}>
        <div className="metric-grid">
          <Metric
            label="Triggers / executions"
            value={formatNumber(result.data?.executions)}
          />
          <Metric label="Success rate" value={`${success}%`} tone="green" />
          <Metric
            label="Failures"
            value={formatNumber(result.data?.failed)}
            tone="amber"
          />
          <Metric
            label="Average duration"
            value={`${formatNumber(result.data?.avg_duration_seconds)}s`}
          />
        </div>
      </DataState>
    </>
  );
}

export function WorkflowSimulatorPage() {
  const workflows = useApi<ApiRecord>("/workflows?limit=100"),
    [workflow, setWorkflow] = useState(""),
    [payload, setPayload] = useState(
      '{"text":"help","contactId":"00000000-0000-4000-8000-000000000000"}',
    ),
    [trace, setTrace] = useState<ApiRecord | null>(null),
    action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="Safe testing"
        title="Workflow test & simulator"
        description="Preview conditions and side effects without sending WhatsApp messages or HTTP requests."
      />
      <section className="card narrow-card">
        <label>
          Workflow
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
          >
            <option value="">Select workflow</option>
            {listOf(workflows.data).map((row) => (
              <option key={text(row.id)} value={text(row.id)}>
                {text(row.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sample event payload
          <textarea
            rows={9}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </label>
        <button
          className="primary-button"
          disabled={!workflow}
          onClick={async () => {
            try {
              const value = await action.run(
                () =>
                  api<ApiRecord>(`/workflows/${workflow}/sandbox`, {
                    method: "POST",
                    body: JSON.stringify({
                      payload: JSON.parse(payload),
                      variables: {},
                    }),
                  }),
                "Simulation completed without side effects.",
              );
              setTrace(value);
            } catch {
              setTrace(null);
            }
          }}
        >
          <CirclePlay />
          Run simulation
        </button>
        {(action.error || action.message) && (
          <Notice success={Boolean(action.message)}>
            {action.error || action.message}
          </Notice>
        )}
        {trace && (
          <pre className="code-block">{JSON.stringify(trace, null, 2)}</pre>
        )}
      </section>
    </>
  );
}

export function AdminAutomationsPage() {
  const overview = useApi<ApiRecord>("/internal/admin/v1/automations/overview"),
    failures = useApi<ApiRecord[]>("/internal/admin/v1/automations/failures"),
    action = useAction();
  const pause = async (workflowId: unknown) => {
    if (!window.confirm("Emergency-pause this workflow?")) return;
    await action.run(
      () =>
        api(`/internal/admin/v1/automations/${workflowId}/emergency-pause`, {
          method: "POST",
        }),
      "Workflow emergency-paused.",
    );
    await Promise.all([overview.refresh(), failures.refresh()]);
  };
  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Automation health"
        description="Monitor failures and pause suspicious workflows without viewing credentials."
      />
      <div className="metric-grid">
        <Metric
          label="Workflows"
          value={formatNumber(overview.data?.workflows)}
        />
        <Metric
          label="Active"
          value={formatNumber(overview.data?.active_workflows)}
          tone="green"
        />
        <Metric
          label="Recent failures"
          value={formatNumber(failures.data?.length)}
          tone="amber"
        />
        <Metric
          label="Queue backlog"
          value={formatNumber(
            number((overview.data?.queue as ApiRecord | undefined)?.waiting) +
              number((overview.data?.queue as ApiRecord | undefined)?.delayed),
          )}
        />
        <Metric
          label="Suspicious tenants"
          value={formatNumber(overview.data?.suspicious_tenants)}
          tone="amber"
        />
      </div>
      <section className="card">
        <DataState
          loading={failures.loading}
          error={failures.error}
          empty={!failures.data?.length}
        >
          <SimpleTable
            rows={failures.data ?? []}
            columns={[
              { key: "workflow_name", label: "Workflow" },
              { key: "organization_id", label: "Tenant" },
              { key: "failure_code", label: "Code" },
              { key: "failure_reason", label: "Failure" },
              {
                key: "actions",
                label: "Action",
                render: (row) => (
                  <button
                    className="danger-button"
                    onClick={() => void pause(row.workflow_id)}
                  >
                    <Pause />
                    Pause
                  </button>
                ),
              },
              {
                key: "updated_at",
                label: "Updated",
                render: (r) => formatDate(r.updated_at),
              },
            ]}
          />
        </DataState>
      </section>
      {action.error && <Notice>{action.error}</Notice>}
    </>
  );
}
