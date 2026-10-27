import { useState } from "react";
import {
  Activity,
  DatabaseBackup,
  Fingerprint,
  Globe2,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  api,
  formatDate,
  formatNumber,
  number,
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

function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return action.error || action.message ? (
    <Notice success={Boolean(action.message)}>
      {action.error || action.message}
    </Notice>
  ) : null;
}

export function EnterpriseSecurityPage() {
  const policy = useApi<ApiRecord>("/enterprise/security-policy");
  const sessions = useApi<ApiRecord[]>("/enterprise/sessions");
  const factors = useApi<ApiRecord[]>("/auth/mfa");
  const action = useAction();
  const [form, setForm] = useState<{
    requireMfa: boolean;
    sessionLifetimeMinutes: number;
    idleTimeoutMinutes: number;
    passwordLoginEnabled: boolean;
  } | null>(null);
  const [factorName, setFactorName] = useState("Authenticator");
  const [enrollment, setEnrollment] = useState<ApiRecord | null>(null);
  const [code, setCode] = useState("");
  const policyForm = form ?? {
    requireMfa: Boolean(policy.data?.requireMfa ?? policy.data?.require_mfa),
    sessionLifetimeMinutes:
      number(
        policy.data?.sessionLifetimeMinutes ??
          policy.data?.session_lifetime_minutes,
      ) || 10080,
    idleTimeoutMinutes:
      number(
        policy.data?.idleTimeoutMinutes ?? policy.data?.idle_timeout_minutes,
      ) || 60,
    passwordLoginEnabled:
      policy.data?.passwordLoginEnabled !== undefined ||
      policy.data?.password_login_enabled !== undefined
        ? Boolean(
            policy.data?.passwordLoginEnabled ??
              policy.data?.password_login_enabled,
          )
        : true,
  };
  const save = async () => {
    if (
      await action.run(
        () =>
          api("/enterprise/security-policy", {
            method: "PATCH",
            body: JSON.stringify(policyForm),
          }),
        "Security policy updated.",
      )
    ) {
      await policy.refresh();
      setForm(null);
    }
  };
  const setup = async () => {
    const result = await action.run(
      () =>
        api<ApiRecord>("/auth/mfa/setup", {
          method: "POST",
          body: JSON.stringify({ name: factorName }),
        }),
      "Scan the secret and verify the code.",
    );
    if (result) setEnrollment(result);
  };
  const verify = async () => {
    if (!enrollment) return;
    if (
      await action.run(
        () =>
          api("/auth/mfa/verify", {
            method: "POST",
            body: JSON.stringify({ factorId: enrollment.id, code }),
          }),
        "MFA enabled.",
      )
    ) {
      setEnrollment(null);
      setCode("");
      await factors.refresh();
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Security settings"
        description="Enforced MFA, session lifetime, idle timeout and password-login controls."
      />
      <Feedback action={action} />
      <div className="metric-grid">
        <Metric
          label="Active sessions"
          value={sessions.data?.length ?? 0}
          tone="blue"
        />
        <Metric
          label="MFA factors"
          value={factors.data?.length ?? 0}
          tone="green"
        />
        <Metric
          label="Idle timeout"
          value={`${policyForm.idleTimeoutMinutes} min`}
        />
        <Metric
          label="MFA policy"
          value={policyForm.requireMfa ? "Required" : "Optional"}
          tone={policyForm.requireMfa ? "green" : "amber"}
        />
      </div>
      <section className="card">
        <h2>
          <ShieldCheck /> Organization policy
        </h2>
        <div className="form-grid">
          <label>
            <span>Session lifetime (minutes)</span>
            <input
              type="number"
              min="15"
              max="43200"
              value={policyForm.sessionLifetimeMinutes}
              onChange={(e) =>
                setForm({
                  ...policyForm,
                  sessionLifetimeMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            <span>Idle timeout (minutes)</span>
            <input
              type="number"
              min="5"
              max="1440"
              value={policyForm.idleTimeoutMinutes}
              onChange={(e) =>
                setForm({
                  ...policyForm,
                  idleTimeoutMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={policyForm.requireMfa}
              onChange={(e) =>
                setForm({ ...policyForm, requireMfa: e.target.checked })
              }
            />{" "}
            Require MFA for every member
          </label>
          <label>
            <input
              type="checkbox"
              checked={policyForm.passwordLoginEnabled}
              disabled
            />{" "}
            Password login (required until OIDC sign-in is deployed)
          </label>
        </div>
        <button
          className="primary-button"
          disabled={action.working}
          onClick={() => void save()}
        >
          Save policy
        </button>
      </section>
      <section className="card">
        <h2>
          <Fingerprint /> Authenticator enrollment
        </h2>
        {enrollment ? (
          <div className="form-grid">
            <label className="full-field">
              <span>One-time secret — store it now</span>
              <input readOnly value={text(enrollment.secret)} />
            </label>
            <label>
              <span>6-digit code</span>
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button className="primary-button" onClick={() => void verify()}>
              Verify factor
            </button>
          </div>
        ) : (
          <div className="inline-form">
            <label>
              <span>Factor name</span>
              <input
                value={factorName}
                onChange={(e) => setFactorName(e.target.value)}
              />
            </label>
            <button className="secondary-button" onClick={() => void setup()}>
              <KeyRound />
              Add authenticator
            </button>
          </div>
        )}
        <SimpleTable
          rows={factors.data ?? []}
          columns={[
            { key: "name", label: "Factor" },
            { key: "type", label: "Type" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "verifiedAt",
              label: "Verified",
              render: (r) => formatDate(r.verifiedAt),
            },
          ]}
        />
      </section>
      <section className="card">
        <h2>Sessions</h2>
        <button
          className="danger-button"
          onClick={() =>
            void action
              .run(
                () =>
                  api("/enterprise/sessions/revoke", {
                    method: "POST",
                    body: JSON.stringify({
                      reason: "Administrator revoke all",
                    }),
                  }),
                "Sessions revoked.",
              )
              .then(() => sessions.refresh())
          }
        >
          Revoke all organization sessions
        </button>
        <SimpleTable
          rows={sessions.data ?? []}
          columns={[
            { key: "fullName", label: "User" },
            { key: "authMethod", label: "Method" },
            {
              key: "mfaVerifiedAt",
              label: "MFA",
              render: (r) => (r.mfaVerifiedAt ? "Verified" : "Not verified"),
            },
            {
              key: "lastSeenAt",
              label: "Last seen",
              render: (r) => formatDate(r.lastSeenAt),
            },
            {
              key: "expiresAt",
              label: "Expires",
              render: (r) => formatDate(r.expiresAt),
            },
          ]}
        />
      </section>
    </>
  );
}

export function EnterpriseSsoPage() {
  const result = useApi<ApiRecord[]>("/enterprise/sso"),
    action = useAction();
  const [form, setForm] = useState({
    name: "Corporate OIDC",
    issuerUrl: "https://accounts.example.com",
    clientId: "",
    clientSecret: "",
    redirectUri: `${window.location.origin}/sso/callback`,
    allowedDomains: "example.com",
    enabled: false,
  });
  const create = async () => {
    if (
      await action.run(
        () =>
          api("/enterprise/sso", {
            method: "POST",
            body: JSON.stringify({
              ...form,
              allowedDomains: form.allowedDomains
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          }),
        "SSO connection stored securely.",
      )
    )
      await result.refresh();
  };
  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Single sign-on"
        description="Store and validate OIDC configuration safely. SSO sign-in is not enabled in this release."
      />
      <Feedback action={action} />
      <section className="card">
        <div className="form-grid">
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span>Issuer URL</span>
            <input
              value={form.issuerUrl}
              onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
            />
          </label>
          <label>
            <span>Client ID</span>
            <input
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            />
          </label>
          <label>
            <span>Client secret</span>
            <input
              type="password"
              value={form.clientSecret}
              onChange={(e) =>
                setForm({ ...form, clientSecret: e.target.value })
              }
            />
          </label>
          <label className="full-field">
            <span>Redirect URI</span>
            <input
              value={form.redirectUri}
              onChange={(e) =>
                setForm({ ...form, redirectUri: e.target.value })
              }
            />
          </label>
          <label className="full-field">
            <span>Allowed domains</span>
            <input
              value={form.allowedDomains}
              onChange={(e) =>
                setForm({ ...form, allowedDomains: e.target.value })
              }
            />
          </label>
        </div>
        <button className="primary-button" onClick={() => void create()}>
          Add connection
        </button>
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
              { key: "name", label: "Connection" },
              { key: "issuerUrl", label: "Issuer" },
              {
                key: "enabled",
                label: "Enabled",
                render: (r) => text(r.enabled),
              },
              {
                key: "lastTestStatus",
                label: "Discovery",
                render: (r) => <Status value={r.lastTestStatus} />,
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void action
                        .run(
                          () =>
                            api(`/enterprise/sso/${r.id}/test`, {
                              method: "POST",
                            }),
                          "OIDC discovery succeeded.",
                        )
                        .then(() => result.refresh())
                    }
                  >
                    Test
                  </button>
                ),
              },
            ]}
          />
        </DataState>
      </section>
    </>
  );
}

export function PrivacyRequestsPage() {
  const requests = useApi<ApiRecord[]>("/privacy/requests"),
    action = useAction();
  const [form, setForm] = useState({
    requestType: "ACCESS",
    subjectType: "CONTACT",
    subjectId: "",
    jurisdiction: "DPDP",
    password: "",
  });
  const submit = async () => {
    if (
      await action.run(
        () =>
          api("/privacy/requests", {
            method: "POST",
            body: JSON.stringify(form),
          }),
        "Verified privacy request created.",
      )
    ) {
      setForm({ ...form, password: "" });
      await requests.refresh();
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Privacy"
        title="Data requests"
        description="Verified, auditable access, correction, restriction, consent and deletion workflows."
      />
      <Feedback action={action} />
      <section className="card">
        <div className="form-grid">
          <label>
            <span>Request</span>
            <select
              value={form.requestType}
              onChange={(e) =>
                setForm({ ...form, requestType: e.target.value })
              }
            >
              {[
                "ACCESS",
                "EXPORT",
                "CORRECTION",
                "DELETION",
                "CONSENT_WITHDRAWAL",
                "RESTRICTION",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Subject</span>
            <select
              value={form.subjectType}
              onChange={(e) =>
                setForm({ ...form, subjectType: e.target.value })
              }
            >
              <option>CONTACT</option>
              <option>USER</option>
            </select>
          </label>
          <label>
            <span>Subject UUID</span>
            <input
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            />
          </label>
          <label>
            <span>Jurisdiction</span>
            <select
              value={form.jurisdiction}
              onChange={(e) =>
                setForm({ ...form, jurisdiction: e.target.value })
              }
            >
              {["GDPR", "UK_GDPR", "DPDP", "CCPA", "LGPD", "OTHER"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Confirm your password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        </div>
        <button className="primary-button" onClick={() => void submit()}>
          Submit verified request
        </button>
      </section>
      <section className="card">
        <SimpleTable
          rows={requests.data ?? []}
          columns={[
            { key: "requestType", label: "Type" },
            { key: "subjectType", label: "Subject" },
            { key: "jurisdiction", label: "Jurisdiction" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "dueAt", label: "Due", render: (r) => formatDate(r.dueAt) },
          ]}
        />
      </section>
    </>
  );
}

export function RetentionSettingsPage() {
  const policies = useApi<ApiRecord[]>("/enterprise/retention-policies"),
    jobs = useApi<ApiRecord[]>("/enterprise/deletion-jobs"),
    action = useAction();
  const update = async (row: ApiRecord) => {
    const days = Number(
      window.prompt("Retention days", text(row.retentionDays, "90")),
    );
    if (!Number.isFinite(days)) return;
    await action.run(
      () =>
        api(`/enterprise/retention-policies/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            retentionDays: days,
            legalBasis: text(row.legalBasis, "Operational requirement"),
            deletionMethod: text(row.deletionMethod, "DELETE"),
            legalHold: Boolean(row.legalHold),
          }),
        }),
      "Retention policy updated.",
    );
    await policies.refresh();
  };
  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Data retention"
        description="Policies are enforced by bounded background deletion or anonymization jobs; legal holds stop execution."
      />
      <Feedback action={action} />
      <section className="card">
        <SimpleTable
          rows={policies.data ?? []}
          columns={[
            { key: "dataCategory", label: "Category" },
            { key: "retentionDays", label: "Days" },
            { key: "deletionMethod", label: "Method" },
            {
              key: "legalHold",
              label: "Legal hold",
              render: (r) => (r.legalHold ? "Active" : "None"),
            },
            {
              key: "actions",
              label: "",
              render: (r) => (
                <button
                  className="secondary-button"
                  onClick={() => void update(r)}
                >
                  Edit
                </button>
              ),
            },
          ]}
        />
      </section>
      <section className="card">
        <h2>
          <Trash2 />
          Deletion jobs
        </h2>
        <SimpleTable
          rows={jobs.data ?? []}
          columns={[
            { key: "dataCategory", label: "Category" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "rowsProcessed",
              label: "Rows",
              render: (r) => formatNumber(r.rowsProcessed),
            },
            {
              key: "cutoffAt",
              label: "Cutoff",
              render: (r) => formatDate(r.cutoffAt),
            },
          ]}
        />
      </section>
    </>
  );
}

export function EnterpriseOrganizationPage() {
  const residency = useApi<ApiRecord>("/enterprise/residency");
  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Organization & residency"
        description="Shows the requested placement separately from the verified data plane. A label is not a residency guarantee."
      />
      <section className="metric-grid">
        <Metric
          label="Requested region"
          value={text(residency.data?.requestedRegion)}
          tone="blue"
        />
        <Metric
          label="Actual data plane"
          value={text(residency.data?.actualRegion)}
          tone="amber"
        />
        <Metric label="Migration status" value={text(residency.data?.status)} />
        <Metric
          label="Verified"
          value={
            residency.data?.verifiedAt
              ? formatDate(residency.data.verifiedAt)
              : "Not verified"
          }
        />
      </section>
      <section className="card">
        <h2>
          <Globe2 />
          Residency boundary
        </h2>
        <p>
          Database, Redis, object storage, backups, logs, encryption keys and
          support access must all be verified in-region before the assignment
          can be marked verified.
        </p>
      </section>
    </>
  );
}

export function AdminPlatformHealthPage() {
  const health = useApi<ApiRecord>("/internal/admin/v1/platform/health"),
    queues = useApi<ApiRecord[]>("/internal/admin/v1/platform/queues");
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Production health"
        description="Database, queue and control-plane signals for operational response."
      />
      <div className="metric-grid">
        <Metric
          label="Platform"
          value={text(health.data?.status)}
          tone="green"
        />
        <Metric
          label="Active tenants"
          value={formatNumber(health.data?.active_tenants)}
        />
        <Metric
          label="Open incidents"
          value={formatNumber(health.data?.open_incidents)}
          tone="amber"
        />
        <Metric
          label="Overdue privacy"
          value={formatNumber(health.data?.overdue_privacy_requests)}
          tone="amber"
        />
      </div>
      <section className="card">
        <h2>
          <Activity />
          Queue backlog
        </h2>
        <SimpleTable
          rows={queues.data ?? []}
          columns={[
            { key: "name", label: "Queue" },
            {
              key: "waiting",
              label: "Counts",
              render: (r) => JSON.stringify(r.counts ?? {}),
            },
          ]}
        />
      </section>
    </>
  );
}

export function AdminSecurityIncidentsPage() {
  const incidents = useApi<ApiRecord[]>(
      "/internal/admin/v1/platform/incidents",
    ),
    action = useAction();
  const [form, setForm] = useState({
    title: "",
    severity: "HIGH",
    category: "SECURITY",
    summary: "",
  });
  const create = async () => {
    if (
      await action.run(
        () =>
          api("/internal/admin/v1/platform/incidents", {
            method: "POST",
            body: JSON.stringify(form),
          }),
        "Incident opened.",
      )
    ) {
      setForm({ ...form, title: "", summary: "" });
      await incidents.refresh();
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Security operations"
        title="Incident management"
        description="Audited triage, containment and resolution records without exposing customer secrets."
      />
      <Feedback action={action} />
      <section className="card">
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            <span>Severity</span>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="full-field">
            <span>Summary</span>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
        </div>
        <button className="primary-button" onClick={() => void create()}>
          <ShieldAlert />
          Open incident
        </button>
      </section>
      <section className="card">
        <SimpleTable
          rows={incidents.data ?? []}
          columns={[
            { key: "title", label: "Incident" },
            {
              key: "severity",
              label: "Severity",
              render: (r) => <Status value={r.severity} />,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "detected_at",
              label: "Detected",
              render: (r) => formatDate(r.detected_at),
            },
          ]}
        />
      </section>
    </>
  );
}

export function AdminPrivacyOperationsPage() {
  const requests = useApi<ApiRecord[]>("/internal/admin/v1/privacy/requests");
  return (
    <>
      <PageHeader
        eyebrow="Privacy operations"
        title="Request review"
        description="Track verified data-subject requests, legal holds and response deadlines."
      />
      <section className="card">
        <SimpleTable
          rows={requests.data ?? []}
          columns={[
            { key: "organization_name", label: "Organization" },
            { key: "request_type", label: "Request" },
            { key: "jurisdiction", label: "Jurisdiction" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "due_at",
              label: "Due",
              render: (r) => formatDate(r.due_at),
            },
          ]}
        />
      </section>
    </>
  );
}

export function AdminRecoveryPage() {
  const records = useApi<ApiRecord[]>("/internal/admin/v1/platform/backups"),
    action = useAction();
  const [form, setForm] = useState({
    region: "GLOBAL",
    backupReference: "",
    backupType: "PITR",
    status: "PASSED",
    evidenceReference: "",
  });
  const record = async () => {
    if (
      await action.run(
        () =>
          api("/internal/admin/v1/platform/backups", {
            method: "POST",
            body: JSON.stringify(form),
          }),
        "Restore verification recorded.",
      )
    ) {
      setForm({ ...form, backupReference: "", evidenceReference: "" });
      await records.refresh();
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Reliability"
        title="Backup & recovery evidence"
        description="A backup is not considered recoverable until an independently recorded restore test passes."
      />
      <Feedback action={action} />
      <section className="card">
        <div className="form-grid">
          <label>
            <span>Region</span>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            >
              {["GLOBAL", "EU", "UK", "IN", "US", "BR", "APAC"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select
              value={form.backupType}
              onChange={(e) => setForm({ ...form, backupType: e.target.value })}
            >
              <option>PITR</option>
              <option>FULL</option>
              <option>OBJECT_STORAGE</option>
              <option>SECRETS</option>
            </select>
          </label>
          <label>
            <span>Backup reference</span>
            <input
              value={form.backupReference}
              onChange={(e) =>
                setForm({ ...form, backupReference: e.target.value })
              }
            />
          </label>
          <label>
            <span>Evidence reference</span>
            <input
              value={form.evidenceReference}
              onChange={(e) =>
                setForm({ ...form, evidenceReference: e.target.value })
              }
            />
          </label>
        </div>
        <button className="primary-button" onClick={() => void record()}>
          <DatabaseBackup />
          Record restore test
        </button>
      </section>
      <section className="card">
        <SimpleTable
          rows={records.data ?? []}
          columns={[
            { key: "region", label: "Region" },
            { key: "backup_reference", label: "Reference" },
            { key: "backup_type", label: "Type" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "completed_at",
              label: "Verified",
              render: (r) => formatDate(r.completed_at),
            },
          ]}
        />
      </section>
    </>
  );
}
