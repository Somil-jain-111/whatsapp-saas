import { useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
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
  PageHeader,
  SimpleTable,
  Status,
} from "./components";
import { useApi } from "./hooks";
import { formatMoney } from "./phase-four-utils";

export function AdminOverviewPage() {
  const overview = useApi<ApiRecord>("/internal/admin/v1/overview");
  const customers = useApi<unknown>(
    "/internal/admin/v1/customers?limit=5&page=1",
  );
  const data = overview.data ?? {};
  const messages = number(data.messages_this_month);
  const delivered = number(data.delivered_this_month);
  const deliveryRate = messages ? Math.round((delivered / messages) * 100) : 0;
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Platform overview"
        description="Customers, subscriptions, message delivery, integrations, and security activity across the platform."
        actions={
          <button
            className="button secondary"
            onClick={() => {
              void overview.refresh();
              void customers.refresh();
            }}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <section className="metric-grid four">
        <Metric
          label="Customers"
          value={formatNumber(data.organizations)}
          hint={`${formatNumber(data.new_organizations_this_month)} new this month`}
          tone="blue"
        />
        <Metric
          label="Active subscriptions"
          value={formatNumber(data.active_subscriptions)}
          hint={`${formatNumber(data.trials)} trials`}
          tone="green"
        />
        <Metric
          label="Messages this month"
          value={formatNumber(data.messages_this_month)}
          hint={`${formatNumber(data.messages)} all time`}
        />
        <Metric
          label="Delivered this month"
          value={formatNumber(data.delivered_this_month)}
          hint={`${deliveryRate}% delivery rate`}
          tone="green"
        />
        <Metric
          label="Read this month"
          value={formatNumber(data.read_this_month)}
        />
        <Metric
          label="Failed this month"
          value={formatNumber(data.failed_this_month)}
          tone="amber"
        />
        <Metric
          label="Connected Meta accounts"
          value={formatNumber(data.connected_meta_accounts)}
        />
        <Metric
          label="Audit events this month"
          value={formatNumber(data.audit_events_this_month)}
        />
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Recent customers</h2>
          <Link className="button ghost" to="/admin/customers">
            View all
          </Link>
        </div>
        <DataState
          loading={customers.loading}
          error={customers.error}
          empty={!listOf(customers.data).length}
        >
          <CustomerTable rows={listOf(customers.data)} />
        </DataState>
      </article>
    </>
  );
}

function CustomerTable({ rows }: { rows: ApiRecord[] }) {
  return (
    <SimpleTable
      rows={rows}
      columns={[
        {
          key: "name",
          label: "Customer",
          render: (row) => (
            <Link className="row-link" to={`/admin/customers/${row.id}`}>
              {text(row.name)}
            </Link>
          ),
        },
        { key: "owner_email", label: "Owner" },
        {
          key: "plan_name",
          label: "Plan",
          render: (row) => text(row.plan_name, "No plan"),
        },
        {
          key: "subscription_status",
          label: "Subscription",
          render: (row) => (
            <Status value={row.subscription_status ?? "inactive"} />
          ),
        },
        {
          key: "messages",
          label: "Messages",
          render: (row) => formatNumber(row.messages),
        },
        {
          key: "delivered",
          label: "Delivered",
          render: (row) => formatNumber(row.delivered),
        },
        {
          key: "created_at",
          label: "Joined",
          render: (row) => <DateCell value={row.created_at} />,
        },
      ]}
    />
  );
}

export function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const customers = useApi<unknown>(
    `/internal/admin/v1/customers?limit=100&page=1${query ? `&search=${encodeURIComponent(query)}` : ""}`,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Customers"
        description="Tenant status, owners, subscriptions, adoption, and delivery performance."
      />
      <article className="card table-card">
        <div className="card-heading">
          <h2>All customers</h2>
          <form className="table-search" onSubmit={submit}>
            <input
              className="small-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, slug, or owner email"
            />
            <button className="button secondary">Search</button>
          </form>
        </div>
        <DataState
          loading={customers.loading}
          error={customers.error}
          empty={!listOf(customers.data).length}
        >
          <CustomerTable rows={listOf(customers.data)} />
        </DataState>
      </article>
    </>
  );
}

export function AdminCustomerDetailPage() {
  const { id = "" } = useParams();
  const customer = useApi<ApiRecord>(
    id ? `/internal/admin/v1/customers/${id}` : null,
  );
  const audits = useApi<unknown>(
    id
      ? `/internal/admin/v1/customers/${id}/audit-logs?limit=100&page=1`
      : null,
  );
  const journey = useApi<unknown>(
    id ? `/internal/admin/v1/customers/${id}/journey?limit=100&page=1` : null,
  );
  const value = customer.data;
  const messages = number(value?.messages);
  const delivered = number(value?.delivered);
  return (
    <>
      <PageHeader
        eyebrow="Customer detail"
        title={text(value?.name, "Customer")}
        description={`${text(value?.slug, "")} · ${text(value?.country_code, "")} · ${text(value?.timezone, "")}`}
        actions={
          <Link className="button ghost" to="/admin/customers">
            <ArrowLeft /> Customers
          </Link>
        }
      />
      <DataState
        loading={customer.loading}
        error={customer.error}
        empty={!value}
      >
        {value && (
          <>
            <section className="metric-grid four">
              <Metric
                label="Messages"
                value={formatNumber(value.messages)}
                hint={`${formatNumber(value.messages_this_month)} this month`}
                tone="blue"
              />
              <Metric
                label="Delivered"
                value={formatNumber(value.delivered)}
                hint={`${messages ? Math.round((delivered / messages) * 100) : 0}% delivery rate`}
                tone="green"
              />
              <Metric label="Read" value={formatNumber(value.read)} />
              <Metric
                label="Failed"
                value={formatNumber(value.failed)}
                tone="amber"
              />
              <Metric label="Campaigns" value={formatNumber(value.campaigns)} />
              <Metric label="Contacts" value={formatNumber(value.contacts)} />
              <Metric
                label="Team members"
                value={formatNumber(value.members)}
              />
              <Metric
                label="Workspace status"
                value={<Status value={value.status} />}
              />
            </section>
            <section className="two-column">
              <article className="card detail-list">
                <div>
                  <span>Owner</span>
                  <strong>
                    {text(value.owner_name)} · {text(value.owner_email)}
                  </strong>
                </div>
                <div>
                  <span>Customer since</span>
                  <strong>{formatDate(value.created_at)}</strong>
                </div>
                <div>
                  <span>Region</span>
                  <strong>
                    {text(value.data_region)} · {text(value.currency_code)}
                  </strong>
                </div>
              </article>
              <article className="card detail-list">
                <div>
                  <span>Plan</span>
                  <strong>{text(value.plan_name, "No active plan")}</strong>
                </div>
                <div>
                  <span>Subscription status</span>
                  <Status value={value.subscription_status ?? "inactive"} />
                </div>
                <div>
                  <span>Free trial used</span>
                  <strong>
                    {text(value.trial_used, "false") === "true"
                      ? `Yes · ${formatDate(value.trial_started_at)}`
                      : "No"}
                  </strong>
                </div>
                <div>
                  <span>Trial ended</span>
                  <strong>{formatDate(value.trial_ended_at)}</strong>
                </div>
                <div>
                  <span>Started</span>
                  <strong>{formatDate(value.subscription_started_at)}</strong>
                </div>
                <div>
                  <span>Current period</span>
                  <strong>
                    {formatDate(value.current_period_start)} –{" "}
                    {formatDate(value.current_period_end)}
                  </strong>
                </div>
                <div>
                  <span>Price</span>
                  <strong>
                    {value.subscription_id
                      ? `${formatMoney(value.amount_minor, value.currency)} / ${text(value.interval).toLowerCase()}`
                      : "—"}
                  </strong>
                </div>
              </article>
            </section>
          </>
        )}
      </DataState>
      <article className="card table-card">
        <div className="card-heading">
          <h2>User journey</h2>
          <span>{formatNumber((journey.data as ApiRecord)?.total)} events</span>
        </div>
        <DataState
          loading={journey.loading}
          error={journey.error}
          empty={!listOf(journey.data).length}
        >
          <SimpleTable
            rows={listOf(journey.data)}
            columns={[
              {
                key: "created_at",
                label: "Time",
                render: (row) => <DateCell value={row.created_at} />,
              },
              { key: "user_email", label: "User" },
              {
                key: "event_type",
                label: "Event",
                render: (row) => <Status value={row.event_type} />,
              },
              { key: "path", label: "Screen / step" },
            ]}
          />
        </DataState>
      </article>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Audit logs</h2>
          <span>{formatNumber((audits.data as ApiRecord)?.total)} events</span>
        </div>
        <DataState
          loading={audits.loading}
          error={audits.error}
          empty={!listOf(audits.data).length}
        >
          <SimpleTable
            rows={listOf(audits.data)}
            columns={[
              {
                key: "created_at",
                label: "Time",
                render: (row) => <DateCell value={row.created_at} />,
              },
              { key: "action", label: "Action" },
              { key: "resource_type", label: "Resource" },
              {
                key: "actor_email",
                label: "Actor",
                render: (row) => text(row.actor_email, "System"),
              },
              { key: "ip_address", label: "IP address" },
              {
                key: "metadata",
                label: "Details",
                render: (row) => (
                  <code>{JSON.stringify(row.metadata ?? {})}</code>
                ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}
