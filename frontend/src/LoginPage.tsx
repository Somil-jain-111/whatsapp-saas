import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  api,
  ApiError,
  publicApi,
  publicApiUrl,
  saveAuthResponse,
  type AuthResponse,
} from "./api";
import { Notice } from "./components";

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const apiUrl = publicApiUrl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<AuthResponse>(apiUrl, "/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(mfaCode ? { mfaCode } : {}),
          audience: admin ? "PLATFORM_ADMIN" : "CUSTOMER",
        }),
      });
      saveAuthResponse(result, admin ? "PLATFORM_ADMIN" : "CUSTOMER");
      if (result.mfaSetupRequired) {
        navigate("/enterprise/security");
        return;
      }
      if (admin) {
        navigate("/operations?group=Platform+admin");
        return;
      }
      const subscription = await api<unknown>("/billing/subscription").catch(
        () => null,
      );
      navigate(subscription ? "/" : "/billing");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to sign in.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="connect-page">
      <section className="connect-story">
        <div className="connect-brand">
          <span>{admin ? <ShieldCheck /> : <MessageCircleMore />}</span> Relay
        </div>
        <div className="connect-copy">
          <p className="eyebrow light">
            {admin
              ? "Protected platform operations"
              : "WhatsApp operations, in one place"}
          </p>
          <h1>
            {admin
              ? "Operate the platform securely."
              : "Turn conversations into measurable growth."}
          </h1>
          <p>
            {admin
              ? "Review billing, queues, integrations, and platform health with administrator-only authorization."
              : "Manage contacts, approved templates, campaigns, delivery analytics, and billing from one responsive console."}
          </p>
          <div className="connect-points">
            <span>
              <ShieldCheck /> Role-based access
            </span>
            <span>
              <Zap /> Secure token rotation
            </span>
            <span>
              <BarChart3 /> Auditable operations
            </span>
          </div>
        </div>
        <small>Enterprise-ready identity and messaging operations</small>
      </section>
      <section className="connect-form-wrap">
        <form className="connect-form" onSubmit={submit}>
          <div className="mobile-connect-brand">
            <MessageCircleMore /> Relay
          </div>
          <p className="eyebrow">
            {admin ? "Platform administration" : "Customer workspace"}
          </p>
          <h2>{admin ? "Super admin login" : "Sign in to Relay"}</h2>
          <p>
            Use your Phase 1 account credentials. Sessions automatically rotate
            secure access tokens.
          </p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Authenticator code <span className="muted">(if enabled)</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>
          {error && <Notice>{error}</Notice>}
          {!admin && (
            <button
              className="login-switch"
              type="button"
              onClick={() =>
                navigate(
                  `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`,
                )
              }
            >
              Forgot password?
            </button>
          )}
          <button className="button primary wide" disabled={working}>
            <LockKeyhole /> {working ? "Signing in…" : "Sign in"} <ArrowRight />
          </button>
          {!admin && (
            <button
              className="login-switch"
              type="button"
              onClick={() => navigate("/register")}
            >
              Create a customer account
            </button>
          )}
          <button
            className="login-switch"
            type="button"
            onClick={() => navigate(admin ? "/login" : "/admin/login")}
          >
            {admin ? "Customer login" : "Super admin login"}
          </button>
        </form>
      </section>
    </main>
  );
}
