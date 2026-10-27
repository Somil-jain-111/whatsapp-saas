import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load data.",
      );
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useAction() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const run = useCallback(
    async <T>(action: () => Promise<T>, success: string) => {
      setWorking(true);
      setError("");
      setMessage("");
      try {
        const result = await action();
        setMessage(success);
        return result;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Action failed.");
        return null;
      } finally {
        setWorking(false);
      }
    },
    [],
  );

  return {
    working,
    error,
    message,
    run,
    clear: () => {
      setError("");
      setMessage("");
    },
  };
}
