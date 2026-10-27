import { useMemo, useState, type FormEvent } from "react";
import { Download, Play, Search, ShieldAlert } from "lucide-react";
import { api, download, type ApiRecord } from "./api";
import { apiCatalog, apiGroups, type ApiOperation } from "./api-catalog";
import { Notice, PageHeader } from "./components";
import { useAction } from "./hooks";

function OperationCard({ operation }: { operation: ApiOperation }) {
  const [path, setPath] = useState(operation.path);
  const [body, setBody] = useState(operation.body ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState("uploads");
  const [result, setResult] = useState<unknown>(null);
  const action = useAction();

  async function execute(event: FormEvent) {
    event.preventDefault();
    const value = await action.run(
      async () => {
        if (operation.download) {
          await download(
            path,
            `${operation.name.toLowerCase().replaceAll(" ", "-")}`,
          );
          return { downloaded: true };
        }
        if (operation.multipart) {
          if (!file) throw new Error("Choose a file first.");
          const form = new FormData();
          form.append("file", file);
          if (operation.group === "Uploads") form.append("folder", folder);
          return api(path, { method: operation.method, body: form });
        }
        let parsed: ApiRecord | undefined;
        if (body.trim()) {
          try {
            parsed = JSON.parse(body) as ApiRecord;
          } catch {
            throw new Error("Request body must be valid JSON.");
          }
        }
        return api(path, {
          method: operation.method,
          body: parsed === undefined ? undefined : JSON.stringify(parsed),
        });
      },
      operation.download ? "Download started." : "Request completed.",
    );
    if (value !== null) setResult(value);
  }

  return (
    <article className="card operation-card">
      <div className="operation-heading">
        <span className={`method method-${operation.method.toLowerCase()}`}>
          {operation.method}
        </span>
        <div>
          <h2>{operation.name}</h2>
          {operation.admin && (
            <small>
              <ShieldAlert /> Platform administrator only
            </small>
          )}
        </div>
      </div>
      <form onSubmit={execute}>
        <label>
          Request path
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
          />
        </label>
        {operation.multipart && (
          <>
            <label>
              File
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            {operation.group === "Uploads" && (
              <label>
                Folder
                <input
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  maxLength={100}
                />
              </label>
            )}
          </>
        )}
        {operation.body !== undefined && (
          <label>
            JSON body
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={7}
              spellCheck={false}
            />
          </label>
        )}
        <button className="button primary" disabled={action.working}>
          {operation.download ? <Download /> : <Play />}{" "}
          {action.working
            ? "Running…"
            : operation.download
              ? "Download"
              : "Run request"}
        </button>
      </form>
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice success>{action.message}</Notice>}
      {result !== null && !operation.download && (
        <pre className="api-result">{JSON.stringify(result, null, 2)}</pre>
      )}
    </article>
  );
}

export function OperationsPage() {
  const params = new URLSearchParams(window.location.search);
  const initialGroup = params.get("group") ?? "All APIs";
  const [group, setGroup] = useState(
    apiGroups.includes(initialGroup) ? initialGroup : "All APIs",
  );
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      apiCatalog.filter((operation) => {
        const matchesGroup = group === "All APIs" || operation.group === group;
        const value =
          `${operation.name} ${operation.path} ${operation.method}`.toLowerCase();
        return matchesGroup && value.includes(search.toLowerCase());
      }),
    [group, search],
  );

  return (
    <>
      <PageHeader
        eyebrow="API coverage"
        title="API operations"
        description="Run every browser-callable API from Phases 2–4 and the platform administration API."
      />
      <Notice>
        <strong>{apiCatalog.length} operations integrated.</strong>
        <br />
        Inbound Meta and Stripe webhooks are intentionally excluded because
        providers—not browsers—call them.
      </Notice>
      <div className="operation-filters">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or path"
          />
        </label>
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          <option>All APIs</option>
          {apiGroups.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <section className="operation-grid">
        {filtered.map((operation) => (
          <OperationCard
            key={`${operation.method}-${operation.path}`}
            operation={operation}
          />
        ))}
      </section>
    </>
  );
}
