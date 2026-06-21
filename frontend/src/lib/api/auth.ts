import { request } from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    role: string;
    clusterId?: string;
  };
}

export async function loginUser(data: LoginPayload): Promise<LoginResult> {
  return request<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tqi_token");
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("tqi_token", token);
}

export function setAuthUser(user: LoginResult["user"]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("tqi_user", JSON.stringify(user));
}

export function getAuthUser() {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("tqi_user");
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("tqi_token");
  localStorage.removeItem("tqi_user");
}
