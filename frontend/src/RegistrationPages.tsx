import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  MailCheck,
  MessageCircleMore,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ApiError,
  publicApi,
  publicApiUrl,
  saveAuthResponse,
  type AuthResponse,
} from "./api";
import { Notice } from "./components";

interface RegistrationResponse {
  email: string;
  requiresEmailVerification: boolean;
  verificationToken?: string;
}

function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="connect-page">
      <section className="connect-story">
        <div className="connect-brand">
          <span>
            <MessageCircleMore />
          </span>{" "}
          Relay
        </div>
        <div className="connect-copy">
          <p className="eyebrow light">Secure customer onboarding</p>
          <h1>Build trusted customer conversations.</h1>
          <p>
            Create a protected workspace, verify ownership, and invite your team
            without mixing sign-in and account creation.
          </p>
          <div className="connect-points">
            <span>
              <CheckCircle2 /> Verified customer identity
            </span>
            <span>
              <CheckCircle2 /> Isolated workspace data
            </span>
            <span>
              <CheckCircle2 /> Role-based team access
            </span>
          </div>
        </div>
        <small>Enterprise-ready identity and messaging operations</small>
      </section>
      <section className="connect-form-wrap">{children}</section>
    </main>
  );
}

export function RegistrationPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<RegistrationResponse>(
        publicApiUrl(),
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            fullName,
            email,
            password,
            name,
            slug,
            countryCode,
            currencyCode,
            timezone,
          }),
        },
      );
      const query = new URLSearchParams({ email: result.email });
      if (result.verificationToken)
        query.set("token", result.verificationToken);
      navigate(`/verify-email?${query}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to create your account.",
      );
    } finally {
      setWorking(false);
    }
  }

  function updateOrganizationName(value: string) {
    setName(value);
    setSlug(toSlug(value));
  }

  return (
    <AuthPage>
      <form className="connect-form" onSubmit={submit}>
        <div className="mobile-connect-brand">
          <MessageCircleMore /> Relay
        </div>
        <p className="eyebrow">Customer workspace</p>
        <h2>Create your account</h2>
        <p>Your email must be verified before the workspace can be used.</p>
        <div className="auth-form-grid">
          <label>
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              maxLength={150}
              required
            />
          </label>
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="full-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
            <small>
              Use uppercase, lowercase, number, and special character.
            </small>
          </label>
          <label>
            Organization
            <input
              value={name}
              onChange={(event) => updateOrganizationName(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label>
            Workspace URL
            <input
              value={slug}
              onChange={(event) => setSlug(toSlug(event.target.value))}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={100}
              required
            />
          </label>
          <label>
            Country code
            <input
              value={countryCode}
              onChange={(event) =>
                setCountryCode(event.target.value.toUpperCase())
              }
              pattern="[A-Z]{2}"
              maxLength={2}
              required
            />
          </label>
          <label>
            Currency
            <input
              value={currencyCode}
              onChange={(event) =>
                setCurrencyCode(event.target.value.toUpperCase())
              }
              pattern="[A-Z]{3}"
              maxLength={3}
              required
            />
          </label>
        </div>
        {error && <Notice>{error}</Notice>}
        <button className="button primary wide" disabled={working}>
          <UserPlus /> {working ? "Creating account…" : "Create account"}{" "}
          <ArrowRight />
        </button>
        <button
          className="login-switch"
          type="button"
          onClick={() => navigate("/login")}
        >
          Already have an account? Sign in
        </button>
      </form>
    </AuthPage>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const email = searchParams.get("email") ?? "";
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    token
      ? "Your local verification token is ready."
      : "Check your inbox for a verification link.",
  );
  const [working, setWorking] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<AuthResponse>(
        publicApiUrl(),
        "/auth/verify-email",
        {
          method: "POST",
          body: JSON.stringify({ token, password }),
        },
      );
      saveAuthResponse(result);
      navigate("/billing");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to verify your email.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function resend() {
    if (!email) return;
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<{
        message: string;
        verificationToken?: string;
      }>(publicApiUrl(), "/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (result.verificationToken) setToken(result.verificationToken);
      setMessage(result.message);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to resend verification.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <AuthPage>
      <form className="connect-form" onSubmit={verify}>
        <p className="eyebrow">Email verification</p>
        <h2>Verify your email</h2>
        <p>{message}</p>
        <label>
          Verification token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="one-time-code"
            minLength={32}
            required
          />
        </label>
        <label>
          Account password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="button primary wide" disabled={working}>
          <MailCheck /> {working ? "Verifying…" : "Verify and continue"}
        </button>
        {email && (
          <button
            className="login-switch"
            type="button"
            disabled={working}
            onClick={resend}
          >
            Send a new verification link
          </button>
        )}
        <button
          className="login-switch"
          type="button"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </button>
      </form>
    </AuthPage>
  );
}

export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<AuthResponse>(
        publicApiUrl(),
        "/auth/invitations/accept",
        {
          method: "POST",
          body: JSON.stringify({ token, fullName, password }),
        },
      );
      saveAuthResponse(result);
      navigate("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to accept this invitation.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <AuthPage>
      <form className="connect-form" onSubmit={submit}>
        <p className="eyebrow">Team invitation</p>
        <h2>Join the workspace</h2>
        <p>
          The invitation verifies your email. Existing customers must enter
          their current password.
        </p>
        <label>
          Invitation token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            minLength={32}
            required
          />
        </label>
        <label>
          Full name
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            maxLength={150}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <small>
            New accounts need uppercase, lowercase, number, and special
            character.
          </small>
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="button primary wide" disabled={working}>
          <KeyRound /> {working ? "Joining…" : "Accept invitation"}
        </button>
        <button
          className="login-switch"
          type="button"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </button>
      </form>
    </AuthPage>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await publicApi<{ message: string; resetToken?: string }>(
        publicApiUrl(),
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      if (result.resetToken) {
        navigate(
          `/reset-password?token=${encodeURIComponent(result.resetToken)}`,
        );
        return;
      }
      setMessage(result.message);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to request a password reset.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <AuthPage>
      <form className="connect-form" onSubmit={submit}>
        <p className="eyebrow">Account recovery</p>
        <h2>Forgot your password?</h2>
        <p>Enter your account email and we’ll send a secure reset link.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        {message && <Notice success>{message}</Notice>}
        {error && <Notice>{error}</Notice>}
        <button className="button primary wide" disabled={working}>
          <MailCheck /> {working ? "Sending…" : "Send reset link"}
        </button>
        <button
          className="login-switch"
          type="button"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </button>
      </form>
    </AuthPage>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setWorking(true);
    try {
      await publicApi<{ message: string }>(
        publicApiUrl(),
        "/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({ token, password }),
        },
      );
      navigate("/login", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to reset your password.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <AuthPage>
      <form className="connect-form" onSubmit={submit}>
        <p className="eyebrow">Account recovery</p>
        <h2>Create a new password</h2>
        <p>Resetting your password signs out all existing sessions.</p>
        <label>
          Reset token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            minLength={32}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <small>
            Use uppercase, lowercase, number, and special character.
          </small>
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {error && <Notice>{error}</Notice>}
        <button className="button primary wide" disabled={working}>
          <RotateCcw /> {working ? "Updating…" : "Reset password"}
        </button>
        <button
          className="login-switch"
          type="button"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </button>
      </form>
    </AuthPage>
  );
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
