import { request } from "./client";
import { clearSession, getToken, saveToken, saveUser } from "@/utils/auth";

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
  return getToken();
}

export function setAuthToken(token: string) {
  saveToken(token);
}

export function setAuthUser(user: LoginResult["user"]) {
  saveUser(user);
}

export function getAuthUser() {
  if (typeof window === "undefined") return null;
  const user = window.localStorage.getItem("tqi_user");
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  clearSession();
}
