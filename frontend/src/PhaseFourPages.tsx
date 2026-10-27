import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  FileBarChart,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  download,
  formatDate,
  formatNumber,
  listOf,
  number,
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
import { formatMoney, parseArray } from "./phase-four-utils";

function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  if (action.error) return <Notice>{action.error}</Notice>;
  if (action.message) return <Notice success>{action.message}</Notice>;
  return null;
}

export function BillingHubPage() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState("INR");
  const [interval, setInterval] = useState("MONTH");
  const plans = useApi<unknown>(`/billing/plans?currency=${currency}`);
  const prices = useApi<unknown>(`/billing/prices?currency=${currency}`);
  const subscription = useApi<ApiRecord>("/billing/subscription");
  const invoices = useApi<unknown>("/billing/invoices");
  const payments = useApi<unknown>("/billing/payments");
  const notifications = useApi<unknown>("/billing/notifications");
  const action = useAction();
  const priceRows = listOf(prices.data);

  async function paidAction(path: string, body?: Record<string, unknown>) {
    const result = await action.run(
      () =>
        api<ApiRecord>(path, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        }),
      "Billing request accepted; provider webhooks will confirm the final state.",
    );
    const url = result && text(result.url, "");
    if (url) window.location.assign(url);
    else if (result) void subscription.refresh();
  }
  async function startTrial(planId: unknown) {
    const result = await action.run(
      () =>
        api<ApiRecord>("/billing/trial", {
          method: "POST",
          body: JSON.stringify({ planId }),
        }),
      "Trial started.",
    );
    if (result) {
      await subscription.refresh();
      navigate("/");
    }
  }
  async function selectPlan(plan: ApiRecord) {
    const embedded = Array.isArray(plan.prices)
      ? (plan.prices as ApiRecord[])
      : [];
    const price = [...embedded, ...priceRows].find(
      (row) =>
        text(row.interval) === interval &&
        (row.plan_id === plan.id ||
          row.plan_code === plan.code ||
          embedded.includes(row)),
    );
    if (!price)
      return void action.run(async () => {
        throw new Error(
          `No ${interval.toLowerCase()} ${currency} price is available.`,
        );
      }, "");
    if (
      !subscription.data &&
      number(plan.trial_days) > 0 &&
      number(price.amount_minor) === 0
    )
      return startTrial(plan.id);
    await paidAction(
      subscription.data ? "/billing/subscription/change" : "/billing/checkout",
      { priceId: price.id },
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Phase 4 · Subscription"
        title="Billing and subscription"
        description="Choose regional pricing, manage the provider-backed subscription, and review financial history."
        actions={
          <>
            <Link className="button ghost" to="/usage">
              Usage
            </Link>
            {text(subscription.data?.provider) === "STRIPE" && (
              <button
                className="button secondary"
                onClick={() => void paidAction("/billing/portal-session")}
              >
                <ExternalLink /> Billing portal
              </button>
            )}
          </>
        }
      />
      <Feedback action={action} />
      <section className="billing-overview">
        <article className="card current-plan">
          <div>
            <p className="eyebrow">Current plan</p>
            <h2>{text(subscription.data?.plan_name, "No active plan")}</h2>
            <p>
              {text(
                subscription.data?.status,
                subscription.error || "Choose a plan to begin",
              )}
            </p>
          </div>
          <div className="plan-price">
            <strong>
              {subscription.data
                ? formatMoney(
                    subscription.data.amount_minor,
                    subscription.data.currency,
                  )
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
            <p className="eyebrow">Current period ends</p>
            <strong>{formatDate(subscription.data?.current_period_end)}</strong>
            <span>
              {subscription.data?.cancel_at_period_end
                ? "Cancellation scheduled"
                : "Provider webhook is authoritative"}
            </span>
          </div>
        </article>
      </section>
      {subscription.data && (
        <div className="campaign-actions">
          <button
            className="button secondary"
            onClick={() =>
              void paidAction("/billing/subscription/cancel", {
                immediate: false,
              })
            }
          >
            Cancel at period end
          </button>
          {Boolean(subscription.data.cancel_at_period_end) &&
            text(subscription.data.provider) === "STRIPE" && (
              <button
                className="button primary"
                onClick={() =>
                  void paidAction("/billing/subscription/reactivate")
                }
              >
                Reactivate
              </button>
            )}
        </div>
      )}
      <div className="pricing-toolbar">
        <label>
          Billing cycle
          <select
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
          >
            <option value="MONTH">Monthly</option>
            <option value="YEAR">Yearly</option>
          </select>
        </label>
        <label>
          Currency
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option>USD</option>
            <option>INR</option>
            <option>GBP</option>
            <option>EUR</option>
          </select>
        </label>
      </div>
      <DataState
        loading={plans.loading}
        error={plans.error}
        empty={!listOf(plans.data).length}
      >
        <section className="plan-grid">
          {listOf(plans.data).map((plan) => {
            const planPrices = Array.isArray(plan.prices)
              ? (plan.prices as ApiRecord[])
              : [];
            const price = planPrices.find(
              (row) => text(row.interval) === interval,
            );
            return (
              <article className="card plan-card" key={text(plan.id)}>
                <div>
                  <p className="eyebrow">{text(plan.code)}</p>
                  <h2>{text(plan.name)}</h2>
                  <p>
                    {text(
                      plan.description,
                      "Production WhatsApp operations for your team.",
                    )}
                  </p>
                  <strong className="large-price">
                    {price
                      ? formatMoney(price.amount_minor, price.currency)
                      : "Contact sales"}
                  </strong>
                </div>
                <ul>
                  {(Array.isArray(plan.features)
                    ? (plan.features as ApiRecord[])
                    : []
                  )
                    .filter((feature) => feature.enabled)
                    .slice(0, 6)
                    .map((feature) => (
                      <li key={text(feature.code)}>
                        <Check /> {text(feature.code).replaceAll("_", " ")}
                        {feature.quota !== null && feature.quota !== undefined
                          ? ` · ${formatNumber(feature.quota)}`
                          : ""}
                      </li>
                    ))}
                </ul>
                <div className="plan-buttons">
                  {number(plan.trial_days) > 0 && !subscription.data && (
                    <button
                      className="button ghost wide"
                      disabled={action.working}
                      onClick={() => void startTrial(plan.id)}
                    >
                      Start {text(plan.trial_days)}-day trial
                    </button>
                  )}
                  <button
                    className="button primary wide"
                    disabled={action.working}
                    onClick={() => void selectPlan(plan)}
                  >
                    {subscription.data ? "Change plan" : "Choose plan"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </DataState>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Invoices</h2>
          </div>
          <DataState
            loading={invoices.loading}
            error={invoices.error}
            empty={!listOf(invoices.data).length}
          >
            <SimpleTable
              rows={listOf(invoices.data)}
              columns={[
                {
                  key: "id",
                  label: "Invoice",
                  render: (row) => (
                    <Link
                      className="row-link"
                      to={`/billing/invoices/${row.id}`}
                    >
                      #{text(row.id).slice(0, 8)}
                    </Link>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                {
                  key: "total_minor",
                  label: "Amount",
                  render: (row) => formatMoney(row.total_minor, row.currency),
                },
                {
                  key: "issued_at",
                  label: "Issued",
                  render: (row) => (
                    <DateCell value={row.issued_at ?? row.created_at} />
                  ),
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Payments</h2>
          </div>
          <DataState
            loading={payments.loading}
            error={payments.error}
            empty={!listOf(payments.data).length}
          >
            <SimpleTable
              rows={listOf(payments.data)}
              columns={[
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                {
                  key: "amount_minor",
                  label: "Amount",
                  render: (row) => formatMoney(row.amount_minor, row.currency),
                },
                {
                  key: "refunded_minor",
                  label: "Refunded",
                  render: (row) =>
                    formatMoney(row.refunded_minor, row.currency),
                },
                {
                  key: "paid_at",
                  label: "Paid",
                  render: (row) => <DateCell value={row.paid_at} />,
                },
              ]}
            />
          </DataState>
        </article>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Billing notifications</h2>
        </div>
        <DataState
          loading={notifications.loading}
          error={notifications.error}
          empty={!listOf(notifications.data).length}
        >
          <SimpleTable
            rows={listOf(notifications.data)}
            columns={[
              { key: "type", label: "Event" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "created_at",
                label: "Created",
                render: (row) => <DateCell value={row.created_at} />,
              },
              {
                key: "sent_at",
                label: "Sent",
                render: (row) => <DateCell value={row.sent_at} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function BillingReturnPage({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const subscription = useApi<ApiRecord>("/billing/subscription");
  useEffect(() => {
    void api("/analytics/journey-events", {
      method: "POST",
      body: JSON.stringify({
        eventType: cancelled ? "BILLING_CANCELLED" : "BILLING_RETURNED",
        path: cancelled ? "/billing/cancel" : "/billing/success",
      }),
    }).catch(() => undefined);
  }, [cancelled]);
  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title={cancelled ? "Checkout cancelled" : "Checkout completed"}
        description={
          cancelled
            ? "No payment was completed. You can return to plans whenever you are ready."
            : "Your payment was received. Subscription status updates after the provider webhook is confirmed."
        }
        actions={
          <Link className="button primary" to="/billing">
            Back to billing
          </Link>
        }
      />
      <Notice success={!cancelled}>
        {cancelled
          ? "You returned without completing checkout."
          : `Current subscription status: ${text(subscription.data?.status, subscription.loading ? "checking…" : "pending confirmation")}`}
      </Notice>
    </>
  );
}

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const invoice = useApi<ApiRecord>(id ? `/billing/invoices/${id}` : null);
  const value = invoice.data;
  return (
    <>
      <PageHeader
        eyebrow="Billing document"
        title={`Invoice #${id.slice(0, 8)}`}
        description="Provider-issued invoice totals and secure document links."
        actions={
          <Link className="button ghost" to="/billing">
            <ArrowLeft /> Billing
          </Link>
        }
      />
      <DataState loading={invoice.loading} error={invoice.error} empty={!value}>
        {value && (
          <section className="invoice-sheet card">
            <div>
              <span>Status</span>
              <Status value={value.status} />
            </div>
            <div>
              <span>Subtotal</span>
              <strong>
                {formatMoney(value.subtotal_minor, value.currency)}
              </strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{formatMoney(value.tax_minor, value.currency)}</strong>
            </div>
            <div className="invoice-total">
              <span>Total</span>
              <strong>{formatMoney(value.total_minor, value.currency)}</strong>
            </div>
            <div>
              <span>Issued</span>
              <strong>{formatDate(value.issued_at)}</strong>
            </div>
            <div>
              <span>Due</span>
              <strong>{formatDate(value.due_at)}</strong>
            </div>
            <div className="invoice-links">
              {Boolean(value.hosted_url) && (
                <a
                  className="button secondary"
                  href={String(value.hosted_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink /> Hosted invoice
                </a>
              )}
              {Boolean(value.pdf_url) && (
                <a
                  className="button primary"
                  href={String(value.pdf_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowDownToLine /> Invoice PDF
                </a>
              )}
            </div>
          </section>
        )}
      </DataState>
    </>
  );
}

export function UsageDashboardPage() {
  const overview = useApi<unknown>("/usage/overview");
  const quotas = useApi<unknown>("/usage/quotas");
  const history = useApi<unknown>("/usage/history");
  return (
    <>
      <PageHeader
        eyebrow="Phase 4 · Metering"
        title="Usage and quotas"
        description="Current-period counters are tenant scoped and enforced by backend entitlements."
        actions={
          <button
            className="button secondary"
            onClick={() => {
              void overview.refresh();
              void quotas.refresh();
              void history.refresh();
            }}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <section className="usage-grid">
        {listOf(quotas.data).map((row) => {
          const percent = number(row.quota)
            ? Math.min((number(row.used) / number(row.quota)) * 100, 100)
            : 0;
          return (
            <article className="card quota-card" key={text(row.code)}>
              <div className="card-heading">
                <h2>{text(row.code).replaceAll("_", " ")}</h2>
                <strong>{formatNumber(row.remaining)} left</strong>
              </div>
              <progress max="100" value={percent} />
              <p>
                {formatNumber(row.used)} of {formatNumber(row.quota)} used
              </p>
            </article>
          );
        })}
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Current usage</h2>
          </div>
          <DataState
            loading={overview.loading}
            error={overview.error}
            empty={!listOf(overview.data).length}
          >
            <SimpleTable
              rows={listOf(overview.data)}
              columns={[
                { key: "metric_code", label: "Metric" },
                {
                  key: "quantity",
                  label: "Quantity",
                  render: (row) => formatNumber(row.quantity),
                },
                {
                  key: "period_start",
                  label: "Period start",
                  render: (row) => <DateCell value={row.period_start} />,
                },
                {
                  key: "period_end",
                  label: "Period end",
                  render: (row) => <DateCell value={row.period_end} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Metering history</h2>
          </div>
          <DataState
            loading={history.loading}
            error={history.error}
            empty={!listOf(history.data).length}
          >
            <SimpleTable
              rows={listOf(history.data)}
              columns={[
                { key: "metric_code", label: "Metric" },
                {
                  key: "quantity",
                  label: "Quantity",
                  render: (row) => formatNumber(row.quantity),
                },
                { key: "resource_type", label: "Resource" },
                {
                  key: "occurred_at",
                  label: "Occurred",
                  render: (row) => <DateCell value={row.occurred_at} />,
                },
              ]}
            />
          </DataState>
        </article>
      </section>
    </>
  );
}

export function AnalyticsDashboardPage() {
  const [range, setRange] = useState("30");
  const [anchor] = useState(() => Date.now());
  const start = new Date(anchor - Number(range) * 86400000).toISOString();
  const query = `?start=${encodeURIComponent(start)}`;
  const overview = useApi<ApiRecord>(`/analytics/overview${query}`);
  const campaigns = useApi<unknown>(`/analytics/campaigns${query}`);
  const templates = useApi<unknown>(`/analytics/templates${query}`);
  const messages = useApi<unknown>(`/analytics/messages${query}`);
  const costs = useApi<unknown>(`/analytics/costs${query}`);
  const costRows = listOf(costs.data);
  const knownCost = costRows.filter((row) => row.cost_status === "ESTIMATED");
  const totals = knownCost.reduce<Record<string, number>>((result, row) => {
    const currency = text(row.currency, "UNKNOWN");
    result[currency] = (result[currency] ?? 0) + number(row.amount_minor);
    return result;
  }, {});
  return (
    <>
      <PageHeader
        eyebrow="Phase 4 · Performance"
        title="Messaging analytics"
        description="Compare campaign delivery, template performance, message events, and estimated Meta costs."
        actions={
          <select
            className="button secondary"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        }
      />
      <section className="metric-grid four">
        <Metric
          label="Accepted"
          value={formatNumber(overview.data?.accepted)}
          tone="blue"
        />
        <Metric
          label="Delivery rate"
          value={`${text(overview.data?.delivery_rate, "0")}%`}
          tone="green"
        />
        <Metric
          label="Read rate"
          value={`${text(overview.data?.read_rate, "0")}%`}
        />
        <Metric
          label="Estimated cost"
          value={
            Object.entries(totals)
              .map(([currency, value]) => formatMoney(value, currency))
              .join(" · ") || "Unavailable"
          }
          tone="amber"
        />
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Campaign performance</h2>
          </div>
          <DataState
            loading={campaigns.loading}
            error={campaigns.error}
            empty={!listOf(campaigns.data).length}
          >
            <SimpleTable
              rows={listOf(campaigns.data)}
              columns={[
                {
                  key: "name",
                  label: "Campaign",
                  render: (row) => (
                    <Link
                      className="row-link"
                      to={`/analytics/campaigns/${row.id}`}
                    >
                      {text(row.name)}
                    </Link>
                  ),
                },
                { key: "total", label: "Total" },
                { key: "delivered", label: "Delivered" },
                { key: "read", label: "Read" },
                { key: "failed", label: "Failed" },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Template performance</h2>
          </div>
          <DataState
            loading={templates.loading}
            error={templates.error}
            empty={!listOf(templates.data).length}
          >
            <SimpleTable
              rows={listOf(templates.data)}
              columns={[
                { key: "name", label: "Template" },
                { key: "usage_count", label: "Uses" },
                { key: "delivered", label: "Delivered" },
                { key: "read", label: "Read" },
                { key: "failed", label: "Failed" },
              ]}
            />
          </DataState>
        </article>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Recent message analytics</h2>
          <span>{listOf(messages.data).length} events</span>
        </div>
        <DataState
          loading={messages.loading}
          error={messages.error}
          empty={!listOf(messages.data).length}
        >
          <SimpleTable
            rows={listOf(messages.data).slice(0, 100)}
            columns={[
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              { key: "raw_provider_status", label: "Provider" },
              { key: "error_code", label: "Error" },
              {
                key: "created_at",
                label: "Created",
                render: (row) => <DateCell value={row.created_at} />,
              },
              {
                key: "delivered_at",
                label: "Delivered",
                render: (row) => <DateCell value={row.delivered_at} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function CampaignAnalyticsDetailPage() {
  const { id = "" } = useParams();
  const analytics = useApi<ApiRecord>(id ? `/analytics/campaigns/${id}` : null);
  const data = analytics.data;
  const funnel: Array<[string, unknown]> = data
    ? [
        ["Accepted", data.accepted],
        ["Sent", data.sent],
        ["Delivered", data.delivered],
        ["Read", data.read],
      ]
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Campaign analytics"
        title={text(data?.name, "Campaign performance")}
        description="Provider-confirmed funnel metrics for this tenant-owned campaign."
        actions={
          <Link className="button ghost" to="/analytics">
            <ArrowLeft /> Analytics
          </Link>
        }
      />
      <DataState
        loading={analytics.loading}
        error={analytics.error}
        empty={!data}
      >
        {data && (
          <>
            <section className="metric-grid four">
              <Metric
                label="Targeted"
                value={formatNumber(data.targeted)}
                tone="blue"
              />
              <Metric
                label="Eligible"
                value={formatNumber(data.eligible)}
                tone="green"
              />
              <Metric label="Delivered" value={formatNumber(data.delivered)} />
              <Metric
                label="Failed"
                value={formatNumber(data.failed)}
                tone="amber"
              />
            </section>
            <article className="card funnel">
              <h2>Delivery funnel</h2>
              {funnel.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <progress
                    max={Math.max(number(data.targeted), 1)}
                    value={number(value)}
                  />
                  <strong>{formatNumber(value)}</strong>
                </div>
              ))}
            </article>
          </>
        )}
      </DataState>
    </>
  );
}

export function ReportCenterPage() {
  const reports = useApi<unknown>("/reports/exports");
  const [selected, setSelected] = useState("");
  const detail = useApi<ApiRecord>(
    selected ? `/reports/exports/${selected}` : null,
  );
  const action = useAction();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const result = await action.run(
      () =>
        api("/reports/exports", {
          method: "POST",
          body: JSON.stringify(values),
        }),
      "Report queued for asynchronous generation.",
    );
    if (result) {
      form.reset();
      void reports.refresh();
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Phase 4 · Exports"
        title="Reports"
        description="Generate tenant-scoped CSV, Excel, and PDF exports with expiring private downloads."
        actions={
          <button
            className="button secondary"
            onClick={() => void reports.refresh()}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <Feedback action={action} />
      <form className="card report-builder" onSubmit={create}>
        <div>
          <span className="report-icon">
            <FileBarChart />
          </span>
          <div>
            <p className="eyebrow">New export</p>
            <h2>Build a report</h2>
            <p>Filters are validated by the backend.</p>
          </div>
        </div>
        <label>
          Report type
          <select name="type">
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
          <select name="format">
            <option>CSV</option>
            <option>XLSX</option>
            <option>PDF</option>
          </select>
        </label>
        <button className="button primary" disabled={action.working}>
          <Rocket /> Generate
        </button>
      </form>
      {selected && (
        <article className="card detail-list">
          <div>
            <span>Report</span>
            <strong>
              {text(detail.data?.type)} · {text(detail.data?.format)}
            </strong>
          </div>
          <div>
            <span>Status</span>
            <Status value={detail.data?.status} />
          </div>
          <div>
            <span>Expires</span>
            <strong>{formatDate(detail.data?.expires_at)}</strong>
          </div>
          {detail.error && <Notice>{detail.error}</Notice>}
        </article>
      )}
      <article className="card table-card">
        <div className="card-heading">
          <h2>Export history</h2>
        </div>
        <DataState
          loading={reports.loading}
          error={reports.error}
          empty={!listOf(reports.data).length}
        >
          <SimpleTable
            rows={listOf(reports.data)}
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
                key: "actions",
                label: "",
                render: (row) => (
                  <div className="row-actions">
                    <button onClick={() => setSelected(text(row.id, ""))}>
                      View
                    </button>
                    {text(row.status) === "COMPLETED" && (
                      <button
                        onClick={() =>
                          void download(
                            `/reports/exports/${row.id}/download`,
                            `report-${row.id}.${text(row.format).toLowerCase()}`,
                          )
                        }
                      >
                        Download
                      </button>
                    )}
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

export function AdminBillingPage() {
  const overview = useApi<ApiRecord>("/internal/admin/v1/billing/overview");
  const subscriptions = useApi<unknown>(
    "/internal/admin/v1/billing/subscriptions",
  );
  const payments = useApi<unknown>("/internal/admin/v1/billing/payments");
  const invoices = useApi<unknown>("/internal/admin/v1/billing/invoices");
  const revenue = useApi<unknown>("/internal/admin/v1/billing/revenue");
  const usage = useApi<unknown>("/internal/admin/v1/usage/overview");
  const analytics = useApi<ApiRecord>("/internal/admin/v1/analytics/platform");
  const action = useAction();
  const [showPlan, setShowPlan] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const result = await action.run(async () => {
      const payload = {
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        trialDays: Number(values.trialDays),
        displayOrder: Number(values.displayOrder),
        effectiveFrom: new Date(values.effectiveFrom).toISOString(),
        features: parseArray(values.features, "Features"),
        prices: parseArray(values.prices, "Prices"),
      };
      return api("/internal/admin/v1/plans", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }, "New versioned plan created.");
    if (result) {
      form.reset();
      setShowPlan(false);
    }
  }
  async function updatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const result = await action.run(
      () =>
        api(`/internal/admin/v1/plans/${values.planId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: values.status }),
        }),
      "Plan status updated.",
    );
    if (result) form.reset();
  }
  async function adjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const result = await action.run(
      () =>
        api("/internal/admin/v1/billing/adjustments", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            amountMinor: Number(values.amountMinor),
          }),
        }),
      "Audited billing adjustment created.",
    );
    if (result) {
      form.reset();
      setShowAdjustment(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Billing operations"
        description="Monitor revenue, subscriptions, usage, and audited financial adjustments across tenants."
        actions={
          <>
            <button
              className="button secondary"
              onClick={() => setShowAdjustment((value) => !value)}
            >
              <CircleDollarSign /> Adjustment
            </button>
            <button
              className="button primary"
              onClick={() => setShowPlan((value) => !value)}
            >
              <Plus /> New plan version
            </button>
          </>
        }
      />
      <Feedback action={action} />
      {showPlan && (
        <article className="card inline-form">
          <h2>Create subscription plan</h2>
          <form className="form-grid" onSubmit={createPlan}>
            <label>
              Code
              <input name="code" required maxLength={50} />
            </label>
            <label>
              Name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Description
              <input name="description" maxLength={1000} />
            </label>
            <label>
              Trial days
              <input
                name="trialDays"
                type="number"
                min="0"
                max="365"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Display order
              <input
                name="displayOrder"
                type="number"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Effective from
              <input name="effectiveFrom" type="datetime-local" required />
            </label>
            <label>
              Features JSON
              <textarea
                name="features"
                rows={5}
                defaultValue={
                  '[{"code":"messages","enabled":true,"quota":10000}]'
                }
                required
              />
            </label>
            <label>
              Prices JSON
              <textarea
                name="prices"
                rows={5}
                defaultValue={
                  '[{"currency":"USD","interval":"MONTH","amountMinor":4900,"provider":"STRIPE","providerPriceId":"price_replace"}]'
                }
                required
              />
            </label>
            <div className="form-actions">
              <button className="button primary" disabled={action.working}>
                Create version
              </button>
            </div>
          </form>
          <form className="form-grid compact-form" onSubmit={updatePlan}>
            <label>
              Existing plan ID
              <input name="planId" required />
            </label>
            <label>
              Status
              <select name="status">
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <button className="button secondary" disabled={action.working}>
              Update plan
            </button>
          </form>
        </article>
      )}
      {showAdjustment && (
        <article className="card inline-form">
          <h2>Create billing adjustment</h2>
          <form className="form-grid" onSubmit={adjustment}>
            <label>
              Organization ID
              <input name="organizationId" required />
            </label>
            <label>
              Type
              <select name="type">
                <option>CREDIT</option>
                <option>REFUND</option>
                <option>DEBIT</option>
              </select>
            </label>
            <label>
              Currency
              <input
                name="currency"
                defaultValue="USD"
                pattern="[A-Z]{3}"
                required
              />
            </label>
            <label>
              Amount (minor units)
              <input name="amountMinor" type="number" min="1" required />
            </label>
            <label>
              Reason
              <input name="reason" required maxLength={500} />
            </label>
            <div className="form-actions">
              <button className="button primary" disabled={action.working}>
                Create adjustment
              </button>
            </div>
          </form>
        </article>
      )}
      <section className="metric-grid four">
        <Metric
          label="Active subscriptions"
          value={formatNumber(overview.data?.active_subscriptions)}
          tone="blue"
        />
        <Metric
          label="MRR"
          value={formatMoney(overview.data?.mrr_minor, "USD")}
          tone="green"
        />
        <Metric
          label="Collected this month"
          value={formatMoney(overview.data?.collected_this_month_minor, "USD")}
        />
        <Metric
          label="Failed payments"
          value={formatNumber(overview.data?.failed_payments)}
          tone="amber"
        />
      </section>
      <section className="summary-strip">
        <div>
          <CreditCard />
          <span>
            <strong>{listOf(subscriptions.data).length}</strong>Subscriptions
          </span>
        </div>
        <div>
          <WalletCards />
          <span>
            <strong>{formatNumber(analytics.data?.messages)}</strong>Messages
            this month
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>{listOf(usage.data).length}</strong>Usage counters
          </span>
        </div>
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Subscriptions</h2>
          </div>
          <DataState
            loading={subscriptions.loading}
            error={subscriptions.error}
            empty={!listOf(subscriptions.data).length}
          >
            <SimpleTable
              rows={listOf(subscriptions.data)}
              columns={[
                { key: "organization_id", label: "Organization" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                {
                  key: "current_period_end",
                  label: "Period end",
                  render: (row) => <DateCell value={row.current_period_end} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Revenue</h2>
          </div>
          <DataState
            loading={revenue.loading}
            error={revenue.error}
            empty={!listOf(revenue.data).length}
          >
            <SimpleTable
              rows={listOf(revenue.data)}
              columns={[
                {
                  key: "month",
                  label: "Month",
                  render: (row) => <DateCell value={row.month} />,
                },
                {
                  key: "gross_minor",
                  label: "Gross",
                  render: (row) => formatMoney(row.gross_minor, row.currency),
                },
                {
                  key: "refunds_minor",
                  label: "Refunds",
                  render: (row) => formatMoney(row.refunds_minor, row.currency),
                },
                {
                  key: "net_minor",
                  label: "Net",
                  render: (row) => formatMoney(row.net_minor, row.currency),
                },
              ]}
            />
          </DataState>
        </article>
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Payments</h2>
            <span>{listOf(invoices.data).length} invoices</span>
          </div>
          <DataState
            loading={payments.loading}
            error={payments.error}
            empty={!listOf(payments.data).length}
          >
            <SimpleTable
              rows={listOf(payments.data)}
              columns={[
                { key: "organization_id", label: "Organization" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                {
                  key: "amount_minor",
                  label: "Amount",
                  render: (row) => formatMoney(row.amount_minor, row.currency),
                },
                {
                  key: "created_at",
                  label: "Created",
                  render: (row) => <DateCell value={row.created_at} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Top usage</h2>
          </div>
          <DataState
            loading={usage.loading}
            error={usage.error}
            empty={!listOf(usage.data).length}
          >
            <SimpleTable
              rows={listOf(usage.data).slice(0, 100)}
              columns={[
                { key: "organization_id", label: "Organization" },
                { key: "metric_code", label: "Metric" },
                {
                  key: "quantity",
                  label: "Quantity",
                  render: (row) => formatNumber(row.quantity),
                },
              ]}
            />
          </DataState>
        </article>
      </section>
    </>
  );
}
