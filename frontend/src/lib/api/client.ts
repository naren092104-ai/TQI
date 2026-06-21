const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("tqi_token");
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    console.log(`[API] ${options?.method || "GET"} ${path} - Token: ${token.slice(0, 20)}...`);
  } else {
    console.warn(`[API] ${options?.method || "GET"} ${path} - No token found!`);
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
