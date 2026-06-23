import { toast } from "sonner";
import { clearSession, dispatchSessionExpired, getToken, validateToken } from "@/utils/auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

function logoutWithSessionExpired(): never {
  clearSession();
  dispatchSessionExpired();
  toast.error("Session expired. Please login again");
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
  throw new Error("Session expired. Please login again");
}

function shouldValidateToken(path: string): boolean {
  return path !== "/api/auth/login";
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token && shouldValidateToken(path)) {
    if (!validateToken(token)) {
      return logoutWithSessionExpired();
    }
    headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers,
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    let errorMessage = response.statusText;
    try {
      const json = JSON.parse(body);
      errorMessage = json.error ?? json.message ?? errorMessage;
    } catch {
      errorMessage = body || errorMessage;
    }

    if (response.status === 401 && shouldValidateToken(path)) {
      return logoutWithSessionExpired();
    }

    throw new Error(errorMessage || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchResource<T>(resource: string): Promise<T[]> {
  return request<T[]>(`/api/${resource}`);
}

export async function upsertResource<T>(resource: string, item: T): Promise<T> {
  const id = (item as any)?.id;
  const method = id ? "PUT" : "POST";
  const path = id ? `/api/${resource}/${id}` : `/api/${resource}`;
  return request<T>(path, {
    method,
    body: JSON.stringify(item),
  });
}

export async function patchResource<T>(resource: string, id: string, patch: Partial<T>): Promise<T> {
  return request<T>(`/api/${resource}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteResource(resource: string, id: string): Promise<void> {
  await request<void>(`/api/${resource}/${id}`, {
    method: "DELETE",
  });
}
