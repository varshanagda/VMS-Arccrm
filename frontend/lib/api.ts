import { clearAuthSession, getAccessToken } from "./auth";

// For server-side fetches, use INTERNAL_API_URL to avoid self-signed SSL certificate issues.
const serverSideApiUrl = typeof window === 'undefined' ? process.env.INTERNAL_API_URL : undefined;
export const API_BASE_URL = serverSideApiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";

// For images/assets, always use the public URL so the browser can reach them.
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";
const DEFAULT_TIMEOUT_MS = 30000;

export function resolveApiAssetUrl(value?: string | null): string | null {
  if (!value) return null;

  const base = PUBLIC_API_URL.replace(/\/+$/, "");

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      if (url.pathname.startsWith("/uploads/")) {
        return `${base}${url.pathname}`;
      }
    } catch {
      // Ignore malformed absolute URLs.
    }
    return value;
  }

  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: {
    id: number;
    name: string;
    role: string;
  };
}

export async function loginApi(payload: LoginRequest): Promise<LoginResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? `Login failed (${response.status})`);
  }

  return response.json();
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = getAccessToken();
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);

  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}${path}`,
      {
        ...requestOptions,
        headers,
      },
      timeoutMs
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out for ${path}. Please wait and try again.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Unable to reach the server at ${API_BASE_URL}. Make sure the backend is running and reachable.`);
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function uploadVisitorPhoto(file: File): Promise<{ photo_url: string }> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithTimeout(`${API_BASE_URL}/visitor/photo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? `Photo upload failed (${response.status})`);
  }

  return response.json();
}
export async function assignRole(employeeId: number, role: string): Promise<{ status: string; message: string }> {
  return apiFetch(`/admin/assign-role/${employeeId}?role=${encodeURIComponent(role)}`, {
    method: "POST",
  });
}
