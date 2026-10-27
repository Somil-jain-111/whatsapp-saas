import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from "lucide-react";
import { formatDate, text, type ApiRecord } from "./api";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "green" | "amber" | "blue";
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}

export function Status({ value }: { value: unknown }) {
  const normalized = text(value, "unknown").toLowerCase();
  const positive = [
    "active",
    "approved",
    "completed",
    "paid",
    "delivered",
    "read",
  ];
  const negative = ["failed", "rejected", "cancelled", "expired", "disabled"];
  const tone = positive.includes(normalized)
    ? "positive"
    : negative.includes(normalized)
      ? "negative"
      : "neutral";
  return (
    <span className={`status status-${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

export function DataState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error?: string;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="state">
        <LoaderCircle className="spin" /> Loading data…
      </div>
    );
  if (error)
    return (
      <div className="state state-error">
        <AlertCircle /> {error}
      </div>
    );
  if (empty)
    return (
      <div className="state">
        <Inbox /> Nothing here yet.
      </div>
    );
  return children;
}

export function Notice({
  children,
  success,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div className={`notice ${success ? "notice-success" : ""}`}>
      {success ? <CheckCircle2 /> : <AlertCircle />}
      <div>{children}</div>
    </div>
  );
}

export function SimpleTable({
  rows,
  columns,
}: {
  rows: ApiRecord[];
  columns: {
    key: string;
    label: string;
    render?: (row: ApiRecord) => ReactNode;
  }[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : text(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DateCell({ value }: { value: unknown }) {
  return <>{formatDate(value)}</>;
}
