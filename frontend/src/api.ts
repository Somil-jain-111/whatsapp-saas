export type ApiRecord = Record<string, unknown>;

export interface WorkspaceSession {
  apiUrl: string;
  accessToken: string;
  refreshToken?: string;
  organizationId: string;
  organizations?: Array<{ id: string; name?: string }>;
  mode?: "CUSTOMER" | "PLATFORM_ADMIN";
  user?: { id: string; email: string; fullName: string };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; fullName: string };
  organizations: ApiRecord[];
  platformAdmin: ApiRecord | null;
  mfaSetupRequired?: boolean;
}

export function isPlatformAdmin(session: WorkspaceSession | null) {
  return session?.mode === "PLATFORM_ADMIN";
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const SESSION_KEY = "relay.workspace";

export function readSession(): WorkspaceSession | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as WorkspaceSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: WorkspaceSession) {
  const safeSession = { ...session };
  delete safeSession.refreshToken;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeSession));
}

export function publicApiUrl() {
  return new URL(
    import.meta.env.VITE_API_URL ?? "/api/v1",
    window.location.origin,
  )
    .toString()
    .replace(/\/$/, "");
}

export function saveAuthResponse(
  result: AuthResponse,
  mode: "CUSTOMER" | "PLATFORM_ADMIN" = "CUSTOMER",
) {
  saveSession({
    apiUrl: publicApiUrl(),
    accessToken: result.accessToken,
    organizationId: String(result.organizations[0]?.id ?? ""),
    organizations: result.organizations.map((organization) => ({
      id: String(organization.id ?? ""),
      name: typeof organization.name === "string" ? organization.name : undefined,
    })),
    mode,
    user: result.user,
  });
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = readSession();
  if (!session) throw new ApiError("Connect your workspace first.", 401);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.set("x-organization-id", session.organizationId);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(resolveUrl(session.apiUrl, path), {
    ...init,
    credentials: "include",
    headers,
  });
  if (response.status === 401 && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken(session.apiUrl);
    session.accessToken = refreshed.accessToken;
    saveSession(session);
    headers.set("Authorization", `Bearer ${session.accessToken}`);
    response = await fetch(resolveUrl(session.apiUrl, path), {
      ...init,
      credentials: "include",
      headers,
    });
  }
  return parseResponse<T>(response);
}

export async function publicApi<T = unknown>(
  apiUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  return parseResponse<T>(
    await fetch(resolveUrl(apiUrl, path), {
      ...init,
      credentials: "include",
      headers,
    }),
  );
}

let refreshPromise: Promise<{ accessToken: string }> | null = null;

function refreshAccessToken(apiUrl: string) {
  refreshPromise ??= publicApi<{ accessToken: string }>(apiUrl, "/auth/refresh", {
    method: "POST",
    body: "{}",
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function resolveUrl(apiUrl: string, path: string) {
  const normalized = apiUrl.replace(/\/$/, "");
  return path.startsWith("/internal/")
    ? `${new URL(normalized).origin}${path}`
    : `${normalized}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown =
    response.status === 204
      ? null
      : contentType.includes("application/json")
        ? await response.json()
        : await response.text();

  if (!response.ok) {
    const body = payload as ApiRecord;
    throw new ApiError(
      String(body?.message ?? `Request failed (${response.status})`),
      response.status,
      payload,
    );
  }

  const wrapped = payload as ApiRecord;
  return (wrapped && "data" in wrapped ? wrapped.data : payload) as T;
}

export async function download(path: string, filename: string) {
  const session = readSession();
  if (!session) throw new ApiError("Connect your workspace first.", 401);
  const response = await fetch(resolveUrl(session.apiUrl, path), {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "x-organization-id": session.organizationId,
    },
  });
  if (!response.ok) throw new ApiError("Download failed.", response.status);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function authenticatedStream(path: string, signal: AbortSignal) {
  const session = readSession();
  if (!session) throw new ApiError("Connect your workspace first.", 401);
  const response = await fetch(resolveUrl(session.apiUrl, path), {
    credentials: "include",
    signal,
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${session.accessToken}`,
      "x-organization-id": session.organizationId,
    },
  });
  if (!response.ok || !response.body)
    throw new ApiError("Real-time inbox connection failed.", response.status);
  return response.body;
}

export function listOf(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (!value || typeof value !== "object") return [];
  const record = value as ApiRecord;
  for (const key of ["items", "results", "rows", "data"]) {
    if (Array.isArray(record[key])) return record[key] as ApiRecord[];
  }
  return [];
}

export function text(value: unknown, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

export function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value: unknown) {
  return new Intl.NumberFormat().format(number(value));
}

export function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
