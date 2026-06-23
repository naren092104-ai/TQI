export interface DecodedJwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("tqi_token");
}

export function decodeToken<T extends DecodedJwtPayload = DecodedJwtPayload>(token: string): T | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const decoded = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded?.exp || typeof decoded.exp !== "number") return true;
  return Date.now() >= decoded.exp * 1000;
}

export function validateToken(token: string | null): boolean {
  if (!token) return false;
  return !isTokenExpired(token);
}

export function saveToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tqi_token", token);
  const decoded = decodeToken(token);
  if (decoded?.exp && typeof decoded.exp === "number") {
    window.localStorage.setItem("tqi_token_expiry", String(decoded.exp * 1000));
  }
}

export function saveUser(user: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tqi_user", JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("tqi_token");
  window.localStorage.removeItem("tqi_user");
  window.localStorage.removeItem("tqi_token_expiry");
}

export function logout(redirect = true): void {
  clearSession();
  if (typeof window !== "undefined" && redirect) {
    window.location.href = "/login";
  }
}

export function dispatchSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("tqi:session-expired"));
}
