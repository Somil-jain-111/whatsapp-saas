import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  MessageCircleMore,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, listOf, text, type ApiRecord } from "./api";
import {
  DataState,
  DateCell,
  Notice,
  PageHeader,
  SimpleTable,
  Status,
} from "./components";
import { useAction, useApi } from "./hooks";
import {
  appendTemplateVariable,
  componentsFromEditor,
  metaPopupSize,
  parseEmbeddedSignupResult,
  substituteTemplateVariables,
  templateVariableIndexes,
  type TemplateEditorState,
} from "./phase-two-utils";

declare global {
  interface Window {
    FB?: {
      init(options: Record<string, unknown>): void;
      login(
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>,
      ): void;
    };
  }
}

function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  if (action.error) return <Notice>{action.error}</Notice>;
  if (action.message) return <Notice success>{action.message}</Notice>;
  return null;
}

async function loadMetaSdk(appId: string, version: string) {
  if (!appId || !version)
    throw new Error("Meta Embedded Signup is not configured.");
  if (!window.FB) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(
        "meta-jssdk",
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = "meta-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Unable to load Meta Embedded Signup."));
      document.head.appendChild(script);
    });
  }
  if (!window.FB) throw new Error("Meta Embedded Signup did not initialize.");
  window.FB?.init({ appId, version, cookie: false, xfbml: false });
}

function constrainMetaPopup() {
  const originalOpen = window.open;
  const sizedOpen: typeof window.open = (url, target, features) => {
    const popup = originalOpen.call(window, url, target, features);
    if (!popup || !String(url).startsWith("https://oauth.facebook.com/"))
      return popup;

    const { width, height } = metaPopupSize(
      window.screen.availWidth,
      window.screen.availHeight,
    );
    const left = Math.max(0, (window.screen.availWidth - width) / 2);
    const top = Math.max(0, (window.screen.availHeight - height) / 2);
    const resize = () => {
      popup.resizeTo(width, height);
      popup.moveTo(left, top);
    };
    resize();
    window.setTimeout(resize, 100);
    return popup;
  };
  window.open = sizedOpen;
  return () => {
    if (window.open === sizedOpen) window.open = originalOpen;
  };
}

export function MetaConnectPage() {
  const navigate = useNavigate();
  const action = useAction();
  const runAction = action.run;
  const appConfiguration = useApi<ApiRecord>("/meta/app-configuration");
  const subscription = useApi<ApiRecord>("/billing/subscription");
  const hasPaidMeta = ["ACTIVE", "PAST_DUE"].includes(
    text(subscription.data?.status, ""),
  );
  const [session, setSession] = useState<ApiRecord | null>(null);
  const [code, setCode] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [signupStatus, setSignupStatus] = useState("");
  const completionStarted = useRef(false);

  useEffect(() => constrainMetaPopup(), []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        !["https://www.facebook.com", "https://web.facebook.com"].includes(
          event.origin,
        )
      )
        return;
      const result = parseEmbeddedSignupResult(event.data);
      if (result?.status === "FINISHED") {
        setWabaId(result.wabaId);
        setSignupStatus(
          "Meta authorization received. Synchronizing your account…",
        );
      } else if (result?.status === "CANCELLED") {
        setSignupStatus("Meta authorization was cancelled. You can try again.");
      } else if (result?.status === "ERROR") {
        setSignupStatus(
          "Meta could not complete the connection. Please try again.",
        );
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  async function start() {
    const started = await action.run(
      () => api<ApiRecord>("/meta/onboarding/session", { method: "POST" }),
      "Secure onboarding session created.",
    );
    if (!started) return;
    if (started.configurationRequired) {
      action.clear();
      await appConfiguration.refresh();
      return;
    }
    await openMetaAuthorization(started);
  }

  async function openMetaAuthorization(onboardingSession: ApiRecord) {
    await action.run(async () => {
      await loadMetaSdk(
        text(onboardingSession.appId, ""),
        text(onboardingSession.graphApiVersion, "v23.0"),
      );
      setSession(onboardingSession);
      setCode("");
      setWabaId("");
      setSignupStatus("Complete the secure authorization in the Meta window.");
      completionStarted.current = false;
      window.FB?.login(
        (response) => {
          const authorizationCode = response.authResponse?.code ?? "";
          setCode(authorizationCode);
          if (!authorizationCode)
            setSignupStatus(
              "Meta authorization was not completed. You can try again.",
            );
        },
        {
          config_id: onboardingSession.configurationId,
          display: "popup",
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
          },
        },
      );
      return true;
    }, "Meta authorization window opened.");
  }

  useEffect(() => {
    if (!session || !code || !wabaId || completionStarted.current) return;
    completionStarted.current = true;
    void runAction(
      () =>
        api("/meta/onboarding/complete", {
          method: "POST",
          body: JSON.stringify({ state: session.state, code, wabaId }),
        }),
      "WhatsApp Business Account connected.",
    ).then((result) => {
      if (result) navigate("/integrations");
      else {
        setSession(null);
        setCode("");
        setWabaId("");
        setSignupStatus(
          "Connection failed. Start a new Meta authorization session.",
        );
      }
    });
  }, [code, navigate, runAction, session, wabaId]);

  return (
    <>
      <PageHeader
        eyebrow="Meta Embedded Signup"
        title="Connect WhatsApp"
        description="Authorize your Meta business without sharing access tokens with Relay."
        actions={
          <Link className="button ghost" to="/integrations">
            <ArrowLeft /> Connections
          </Link>
        }
      />
      <Feedback action={action} />
      {!appConfiguration.loading && !appConfiguration.data?.configured && (
        <Notice>
          WhatsApp onboarding is not available yet. A platform administrator
          must configure and approve the Relay Meta Developer App. Customers
          never need to enter an App ID or App Secret.
        </Notice>
      )}
      {!subscription.loading && !hasPaidMeta && (
        <Notice>
          Connecting your own Meta account is available after payment. Complete
          your subscription from <Link to="/billing">Billing &amp; usage</Link>.
        </Notice>
      )}
      {signupStatus && <Notice>{signupStatus}</Notice>}
      <section className="wizard-grid">
        <article className="card wizard-steps">
          <h2>Setup instructions</h2>
          {[
            [
              "Prepare Meta Business Account",
              "Use an existing or create a Meta Business Portfolio.",
            ],
            [
              "Gather Business Details",
              "Keep your legal business name, address, and phone number ready.",
            ],
            [
              "Complete Embedded Signup",
              "Sign in to Meta and select your own business assets.",
            ],
            [
              "Verify Phone Number",
              "Confirm the code or scan the QR code in WhatsApp Business.",
            ],
            [
              "You're All Set",
              "Relay securely synchronizes your WABA and sender number.",
            ],
          ].map((label, index) => (
            <div
              className={
                session && index < 2 ? "wizard-step complete" : "wizard-step"
              }
              key={label[0]}
            >
              <span>{session && index < 2 ? <Check /> : index + 1}</span>
              <div>
                <strong>{label[0]}</strong>
                <small>{label[1]}</small>
              </div>
            </div>
          ))}
        </article>
        <article className="card connect-wizard-panel">
          <span className="integration-icon">
            <MessageCircleMore />
          </span>
          <h2>{session ? "Finish authorization" : "Connect Meta Business"}</h2>
          <p>
            Connect your existing WhatsApp Business number through Meta's
            official Coexistence flow. You can continue using the mobile app.
          </p>
          {!session ? (
            <button
              className="button primary"
              onClick={() => void start()}
              disabled={
                action.working ||
                appConfiguration.loading ||
                subscription.loading ||
                !appConfiguration.data?.configured ||
                !hasPaidMeta
              }
            >
              <Link2 /> Continue with Meta
            </button>
          ) : (
            <div>
              <p>
                {signupStatus ||
                  "Complete the secure authorization in the Meta window."}
              </p>
              <button
                className="button primary"
                type="button"
                onClick={() => void openMetaAuthorization(session)}
                disabled={action.working}
              >
                <Link2 /> Reopen Meta
              </button>
            </div>
          )}
        </article>
      </section>
    </>
  );
}

export function AccountsPage() {
  const accounts = useApi<unknown>("/whatsapp/accounts");
  const rows = listOf(accounts.data);
  return (
    <>
      <PageHeader
        eyebrow="WhatsApp Business"
        title="Accounts"
        description="View authorized WABAs, verification status, and synchronized sender numbers."
        actions={
          <Link className="button primary" to="/integrations/connect">
            <Plus /> Connect account
          </Link>
        }
      />
      <article className="card table-card">
        <DataState
          loading={accounts.loading}
          error={accounts.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "businessName", label: "Business" },
              { key: "providerAccountId", label: "WABA ID" },
              {
                key: "verificationStatus",
                label: "Verification",
                render: (row) => <Status value={row.verificationStatus} />,
              },
              {
                key: "status",
                label: "Account status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "lastSyncedAt",
                label: "Last sync",
                render: (row) => <DateCell value={row.lastSyncedAt} />,
              },
              {
                key: "open",
                label: "",
                render: (row) => (
                  <Link className="row-link" to={`/accounts/${row.id}`}>
                    Manage
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

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const account = useApi<ApiRecord>(id ? `/whatsapp/accounts/${id}` : null);
  const phones = useApi<unknown>(
    id ? `/whatsapp/accounts/${id}/phone-numbers` : null,
  );
  const action = useAction();
  const rows = listOf(phones.data);
  async function makeDefault(phoneId: unknown) {
    const result = await action.run(
      () =>
        api(`/whatsapp/phone-numbers/${phoneId}/default`, { method: "PATCH" }),
      "Default sender updated.",
    );
    if (result) void phones.refresh();
  }
  return (
    <>
      <PageHeader
        eyebrow="WhatsApp account"
        title={text(account.data?.businessName, "Account details")}
        description={`Provider ID ${text(account.data?.providerAccountId)}`}
        actions={
          <Link className="button ghost" to="/accounts">
            <ArrowLeft /> Accounts
          </Link>
        }
      />
      <Feedback action={action} />
      <section className="summary-strip">
        <div>
          <MessageCircleMore />
          <span>
            <strong>{rows.length}</strong>Phone numbers
          </span>
        </div>
        <div>
          <ShieldAlert />
          <span>
            <strong>{text(account.data?.verificationStatus)}</strong>
            Verification
          </span>
        </div>
        <div>
          <RefreshCw />
          <span>
            <strong>{formatDate(account.data?.lastSyncedAt)}</strong>Last
            synchronized
          </span>
        </div>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Authorized phone numbers</h2>
        </div>
        <DataState
          loading={phones.loading}
          error={phones.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "verifiedDisplayName", label: "Display name" },
              { key: "displayPhoneNumber", label: "Phone" },
              { key: "providerPhoneNumberId", label: "Meta ID" },
              {
                key: "qualityRating",
                label: "Quality",
                render: (row) => <Status value={row.qualityRating} />,
              },
              { key: "messagingLimit", label: "Messaging limit" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "default",
                label: "",
                render: (row) =>
                  row.isDefault === true || row.isDefault === "true" ? (
                    <span className="status status-positive">default</span>
                  ) : (
                    <button
                      className="row-link"
                      onClick={() => void makeDefault(row.id)}
                    >
                      <Phone /> Make default
                    </button>
                  ),
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

type EditorState = TemplateEditorState;
const emptyEditor: EditorState = {
  accountId: "",
  name: "",
  language: "en",
  category: "UTILITY",
  headerFormat: "",
  headerText: "",
  headerExamples: [],
  mediaHandle: "",
  body: "",
  bodyExamples: [],
  footer: "",
  buttonType: "",
  buttonText: "",
  buttonValue: "",
};

function TemplatePreview({ form }: { form: EditorState }) {
  return (
    <article className="phone-preview">
      <div className="phone-preview-bar">WhatsApp preview</div>
      <div className="message-bubble">
        {form.headerFormat === "TEXT" && (
          <strong>
            {substituteTemplateVariables(form.headerText, form.headerExamples)}
          </strong>
        )}
        {form.headerFormat && form.headerFormat !== "TEXT" && (
          <div className="media-placeholder">{form.headerFormat} header</div>
        )}
        <p>
          {substituteTemplateVariables(form.body, form.bodyExamples) ||
            "Your template body will appear here."}
        </p>
        {form.footer && <small>{form.footer}</small>}
        {form.buttonType && (
          <button type="button">{form.buttonText || "Button"}</button>
        )}
        <time>12:00 ✓✓</time>
      </div>
      <p className="preview-note">
        Preview is illustrative; final rendering is controlled by Meta.
      </p>
    </article>
  );
}

function VariableExampleFields({
  textValue,
  values,
  onChange,
}: {
  textValue: string;
  values: string[];
  onChange(index: number, value: string): void;
}) {
  const indexes = templateVariableIndexes(textValue);
  if (!indexes.length) return null;
  return (
    <div className="variable-examples">
      <strong>Variable examples</strong>
      <div className="form-grid">
        {indexes.map((index) => (
          <label key={index}>
            {`{{${index}}}`}
            <input
              value={values[index - 1] ?? ""}
              onChange={(event) => onChange(index - 1, event.target.value)}
              placeholder={`Example for {{${index}}}`}
              required
            />
          </label>
        ))}
      </div>
      <small>Examples are required by Meta and are not sent to customers.</small>
    </div>
  );
}

export function TemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useApi<unknown>("/whatsapp/accounts");
  const detail = useApi<ApiRecord>(id ? `/templates/${id}` : null);
  const action = useAction();
  const accountRows = listOf(accounts.data);
  const [form, setForm] = useState<EditorState>(emptyEditor);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!id || !detail.data || loaded) return;
    const template = detail.data.template as ApiRecord;
    const components = listOf((detail.data as ApiRecord).components);
    const component = (type: string) =>
      components.find((row) => row.type === type)?.payload as
        ApiRecord | undefined;
    const header = component("HEADER");
    const body = component("BODY");
    const footer = component("FOOTER");
    const buttons = component("BUTTONS")?.buttons as ApiRecord[] | undefined;
    const button = buttons?.[0];
    // The API detail arrives after mount; hydrate once so later edits are never overwritten.
    // oxlint-disable-next-line react/set-state-in-effect
    setForm({
      accountId: text(template.accountId, ""),
      name: text(template.name, ""),
      language: text(template.language, "en"),
      category: text(template.category, "UTILITY"),
      headerFormat: text(header?.format, ""),
      headerText: text(header?.text, ""),
      headerExamples: Array.isArray(header?.examples) ? header.examples : [],
      mediaHandle: text(header?.exampleHandle, ""),
      body: text(body?.text, ""),
      bodyExamples: Array.isArray(body?.examples) ? body.examples : [],
      footer: text(footer?.text, ""),
      buttonType: text(button?.type, ""),
      buttonText: text(button?.text, ""),
      buttonValue: text(button?.url ?? button?.phoneNumber, ""),
    });
    setLoaded(true);
  }, [detail.data, id, loaded]);
  const update = (key: keyof EditorState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateExample = (
    key: "headerExamples" | "bodyExamples",
    index: number,
    value: string,
  ) =>
    setForm((current) => {
      const examples = [...current[key]];
      examples[index] = value;
      return { ...current, [key]: examples };
    });
  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      accountId: form.accountId,
      name: form.name,
      language: form.language,
      category: form.category,
      components: componentsFromEditor(form),
    };
    const result = await action.run(
      () =>
        api<ApiRecord>(id ? `/templates/${id}` : "/templates", {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }),
      `Template ${id ? "updated" : "created"}.`,
    );
    if (result) navigate(`/templates/${result.id ?? id}`);
  }
  return (
    <>
      <PageHeader
        eyebrow="Template builder"
        title={id ? "Edit template" : "Create a template"}
        description="Build a structured Meta template and verify variable examples before submission."
        actions={
          <Link
            className="button ghost"
            to={id ? `/templates/${id}` : "/templates"}
          >
            <ArrowLeft /> Cancel
          </Link>
        }
      />
      <Feedback action={action} />
      <form className="template-editor" onSubmit={save}>
        <article className="card template-form">
          <div className="form-grid">
            <label>
              WhatsApp account
              <select
                value={form.accountId}
                onChange={(e) => update("accountId", e.target.value)}
                required
              >
                <option value="">Choose account</option>
                {accountRows.map((row) => (
                  <option value={text(row.id)} key={text(row.id)}>
                    {text(row.businessName, "WhatsApp account")}
                  </option>
                ))}
              </select>
              <small>
                Meta credentials are connected securely under{" "}
                <Link to="/integrations/connect">Connect WhatsApp</Link>; never
                paste an access token into a template.
              </small>
            </label>
            <label>
              Template name
              <input
                value={form.name}
                onChange={(e) =>
                  update(
                    "name",
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  )
                }
                pattern="[a-z0-9_]+"
                maxLength={512}
                required
              />
            </label>
            <label>
              Language
              <input
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
                required
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                <option>UTILITY</option>
                <option>MARKETING</option>
                <option>AUTHENTICATION</option>
              </select>
            </label>
          </div>
          <hr />
          <div className="form-grid">
            <label>
              Header type
              <select
                value={form.headerFormat}
                onChange={(e) => update("headerFormat", e.target.value)}
              >
                <option value="">No header</option>
                <option>TEXT</option>
                <option>IMAGE</option>
                <option>VIDEO</option>
                <option>DOCUMENT</option>
              </select>
            </label>
            {form.headerFormat === "TEXT" && (
              <label>
                Header text
                <input
                  value={form.headerText}
                  onChange={(e) => update("headerText", e.target.value)}
                />
                <button
                  className="variable-button"
                  type="button"
                  onClick={() =>
                    update(
                      "headerText",
                      appendTemplateVariable(form.headerText),
                    )
                  }
                >
                  <Plus /> Add variable
                </button>
              </label>
            )}
            {form.headerFormat && form.headerFormat !== "TEXT" && (
              <label>
                Provider media handle
                <input
                  value={form.mediaHandle}
                  onChange={(e) => update("mediaHandle", e.target.value)}
                  required
                />
              </label>
            )}
          </div>
          {form.headerFormat === "TEXT" && (
            <VariableExampleFields
              textValue={form.headerText}
              values={form.headerExamples}
              onChange={(index, value) =>
                updateExample("headerExamples", index, value)
              }
            />
          )}
          <label>
            Body
            <textarea
              rows={7}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              placeholder="Hello {{1}}, your order {{2}} is ready."
              required
            />
            <button
              className="variable-button"
              type="button"
              onClick={() =>
                update("body", appendTemplateVariable(form.body))
              }
            >
              <Plus /> Add variable
            </button>
          </label>
          <VariableExampleFields
            textValue={form.body}
            values={form.bodyExamples}
            onChange={(index, value) =>
              updateExample("bodyExamples", index, value)
            }
          />
          <label>
            Footer
            <input
              value={form.footer}
              onChange={(e) => update("footer", e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="form-grid">
            <label>
              Button type
              <select
                value={form.buttonType}
                onChange={(e) => update("buttonType", e.target.value)}
              >
                <option value="">No button</option>
                <option>QUICK_REPLY</option>
                <option>URL</option>
                <option>PHONE_NUMBER</option>
              </select>
            </label>
            {form.buttonType && (
              <label>
                Button text
                <input
                  value={form.buttonText}
                  onChange={(e) => update("buttonText", e.target.value)}
                  required
                />
              </label>
            )}
            {["URL", "PHONE_NUMBER"].includes(form.buttonType) && (
              <label>
                {form.buttonType === "URL" ? "HTTPS URL" : "E.164 phone"}
                <input
                  value={form.buttonValue}
                  onChange={(e) => update("buttonValue", e.target.value)}
                  required
                />
              </label>
            )}
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={action.working}>
              <Check /> Save draft
            </button>
          </div>
        </article>
        <TemplatePreview form={form} />
      </form>
    </>
  );
}

export function TemplateDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useApi<ApiRecord>(id ? `/templates/${id}` : null);
  const action = useAction();
  const [duplicateName, setDuplicateName] = useState("");
  const template = useMemo(
    () => (detail.data?.template ?? {}) as ApiRecord,
    [detail.data],
  );
  const components = listOf(detail.data?.components);
  const preview = useMemo<EditorState>(() => {
    const find = (type: string) =>
      components.find((row) => row.type === type)?.payload as
        ApiRecord | undefined;
    const header = find("HEADER");
    const body = find("BODY");
    const footer = find("FOOTER");
    const button = (find("BUTTONS")?.buttons as ApiRecord[] | undefined)?.[0];
    return {
      ...emptyEditor,
      name: text(template.name, ""),
      language: text(template.language, "en"),
      category: text(template.category, "UTILITY"),
      headerFormat: text(header?.format, ""),
      headerText: text(header?.text, ""),
      headerExamples: Array.isArray(header?.examples) ? header.examples : [],
      body: text(body?.text, ""),
      bodyExamples: Array.isArray(body?.examples) ? body.examples : [],
      footer: text(footer?.text, ""),
      buttonType: text(button?.type, ""),
      buttonText: text(button?.text, ""),
      buttonValue: text(button?.url ?? button?.phoneNumber, ""),
    };
  }, [components, template]);
  async function operation(name: "submit" | "duplicate" | "archive") {
    const result = await action.run(async () => {
      const response = await api(
        name === "archive" ? `/templates/${id}` : `/templates/${id}/${name}`,
        {
          method: name === "archive" ? "DELETE" : "POST",
          body:
            name === "duplicate"
              ? JSON.stringify({ name: duplicateName })
              : undefined,
        },
      );
      return name === "archive" ? true : response;
    }, `Template ${name} request completed.`);
    if (result && name === "duplicate")
      navigate(`/templates/${(result as ApiRecord).id}`);
    else if (result && name === "archive") navigate("/templates");
    else if (result) void detail.refresh();
  }
  return (
    <>
      <PageHeader
        eyebrow={`${text(template.category)} · ${text(template.language)}`}
        title={text(template.name, "Template")}
        description={`Version ${text(template.currentVersion, "1")} · Updated ${formatDate(template.updatedAt)}`}
        actions={
          <>
            <Link className="button ghost" to="/templates">
              <ArrowLeft /> Templates
            </Link>
            {["DRAFT", "SUBMISSION_FAILED"].includes(
              text(template.localStatus),
            ) && (
              <Link className="button secondary" to={`/templates/${id}/edit`}>
                Edit
              </Link>
            )}
            <button
              className="button primary"
              onClick={() => void operation("submit")}
              disabled={
                action.working ||
                !["DRAFT", "SUBMISSION_FAILED"].includes(
                  text(template.localStatus),
                )
              }
            >
              <Send /> Submit to Meta
            </button>
          </>
        }
      />
      <Feedback action={action} />
      {template.rejectionReason && (
        <Notice>
          <strong>Meta rejection reason:</strong>{" "}
          {text(template.rejectionReason)}
        </Notice>
      )}
      <section className="template-detail-grid">
        <div>
          <article className="card detail-list">
            <div>
              <span>Local status</span>
              <Status value={template.localStatus} />
            </div>
            <div>
              <span>Meta status</span>
              <Status value={template.metaStatus ?? "not submitted"} />
            </div>
            <div>
              <span>Provider template ID</span>
              <strong>{text(template.providerTemplateId)}</strong>
            </div>
            <div>
              <span>Account ID</span>
              <strong>{text(template.accountId)}</strong>
            </div>
          </article>
          <article className="card duplicate-card">
            <h2>Duplicate and resubmit</h2>
            <p>Use a new name when an approved template cannot be edited.</p>
            <div>
              <input
                value={duplicateName}
                onChange={(event) => setDuplicateName(event.target.value)}
                placeholder={`${text(template.name, "template")}_copy`}
              />
              <button
                className="button secondary"
                disabled={!duplicateName || action.working}
                onClick={() => void operation("duplicate")}
              >
                <Copy /> Duplicate
              </button>
            </div>
          </article>
          <button
            className="button danger"
            onClick={() => void operation("archive")}
            disabled={action.working}
          >
            <Trash2 /> Archive local template
          </button>
        </div>
        <TemplatePreview form={preview} />
      </section>
    </>
  );
}

export function IntegrationDiagnosticsPage() {
  const health = useApi<ApiRecord>("/integrations/health");
  const errors = useApi<unknown>("/integrations/errors?limit=100");
  const rows = listOf(errors.data);
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Integration diagnostics"
        description="Review connection state, unresolved provider failures, and synchronization health."
        actions={
          <button
            className="button secondary"
            onClick={() => {
              void health.refresh();
              void errors.refresh();
            }}
          >
            <RefreshCw /> Refresh
          </button>
        }
      />
      <section className="integration-hero card">
        <div className="integration-icon">
          <ShieldAlert />
        </div>
        <div>
          <p className="eyebrow">Overall health</p>
          <h2>{text(health.data?.status, "Unknown")}</h2>
          <p>
            {text(
              health.data?.message,
              "Credential material is never shown in diagnostics.",
            )}
          </p>
        </div>
        <Status value={health.data?.status} />
      </section>
      <article className="card table-card">
        <DataState
          loading={errors.loading}
          error={errors.error}
          empty={!rows.length}
        >
          <SimpleTable
            rows={rows}
            columns={[
              { key: "code", label: "Code" },
              { key: "message", label: "Safe message" },
              { key: "occurrenceCount", label: "Occurrences" },
              {
                key: "resolvedAt",
                label: "State",
                render: (row) => (
                  <Status value={row.resolvedAt ? "resolved" : "open"} />
                ),
              },
              {
                key: "occurredAt",
                label: "Last occurred",
                render: (row) => <DateCell value={row.occurredAt} />,
              },
            ]}
          />
        </DataState>
      </article>
    </>
  );
}

export function AdminIntegrationsPage() {
  const connections = useApi<unknown>("/internal/admin/v1/meta/connections");
  const health = useApi<unknown>("/internal/admin/v1/meta/health");
  const errors = useApi<unknown>("/internal/admin/v1/meta/errors");
  const templates = useApi<unknown>("/internal/admin/v1/templates");
  const templateMetrics = useApi<unknown>(
    "/internal/admin/v1/templates/metrics",
  );
  return (
    <>
      <PageHeader
        eyebrow="Platform administration"
        title="Meta integration monitor"
        description="Cross-tenant operational metadata without exposing credentials or message content."
      />
      <section className="summary-strip">
        <div>
          <Link2 />
          <span>
            <strong>{listOf(connections.data).length}</strong>Connections
          </span>
        </div>
        <div>
          <ShieldAlert />
          <span>
            <strong>{listOf(errors.data).length}</strong>Provider failures
          </span>
        </div>
        <div>
          <MessageCircleMore />
          <span>
            <strong>
              {listOf(templateMetrics.data).reduce(
                (sum, row) => sum + Number(row.count ?? 0),
                0,
              )}
            </strong>
            Templates
          </span>
        </div>
      </section>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Connection health</h2>
          </div>
          <DataState
            loading={health.loading}
            error={health.error}
            empty={!listOf(health.data).length}
          >
            <SimpleTable
              rows={listOf(health.data)}
              columns={[
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
                { key: "count", label: "Connections" },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Template lifecycle</h2>
          </div>
          <DataState
            loading={templateMetrics.loading}
            error={templateMetrics.error}
            empty={!listOf(templateMetrics.data).length}
          >
            <SimpleTable
              rows={listOf(templateMetrics.data)}
              columns={[
                {
                  key: "meta_status",
                  label: "Meta status",
                  render: (row) => <Status value={row.meta_status} />,
                },
                { key: "count", label: "Templates" },
              ]}
            />
          </DataState>
        </article>
      </section>
      <article className="card table-card">
        <div className="card-heading">
          <h2>Tenant connections</h2>
        </div>
        <DataState
          loading={connections.loading}
          error={connections.error}
          empty={!listOf(connections.data).length}
        >
          <SimpleTable
            rows={listOf(connections.data)}
            columns={[
              { key: "organization_id", label: "Organization" },
              { key: "provider_business_id", label: "Provider business" },
              {
                key: "status",
                label: "Status",
                render: (row) => <Status value={row.status} />,
              },
              {
                key: "last_synced_at",
                label: "Last sync",
                render: (row) => <DateCell value={row.last_synced_at} />,
              },
            ]}
          />
        </DataState>
      </article>
      <section className="two-column">
        <article className="card table-card">
          <div className="card-heading">
            <h2>Failed webhook events</h2>
          </div>
          <DataState
            loading={errors.loading}
            error={errors.error}
            empty={!listOf(errors.data).length}
          >
            <SimpleTable
              rows={listOf(errors.data)}
              columns={[
                { key: "organization_id", label: "Organization" },
                { key: "event_type", label: "Event" },
                { key: "attempts", label: "Attempts" },
                {
                  key: "received_at",
                  label: "Received",
                  render: (row) => <DateCell value={row.received_at} />,
                },
              ]}
            />
          </DataState>
        </article>
        <article className="card table-card">
          <div className="card-heading">
            <h2>Recent templates</h2>
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
                { key: "organization_id", label: "Organization" },
                {
                  key: "local_status",
                  label: "Local",
                  render: (row) => <Status value={row.local_status} />,
                },
                {
                  key: "meta_status",
                  label: "Meta",
                  render: (row) => <Status value={row.meta_status} />,
                },
              ]}
            />
          </DataState>
        </article>
      </section>
    </>
  );
}
