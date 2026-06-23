import { create } from "zustand";
import { clearSession, getToken, validateToken } from "@/utils/auth";

interface AuthState {
  user: { id: string; name: string; email: string; role: string; clusterId?: string } | null;
  firstLogin: boolean;
  login: (email: string, userData: { id: string; name: string; email: string; role: string; clusterId?: string }) => void;
  changedPassword: () => void;
  logout: () => void;
  loadFromToken: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  firstLogin: false,
  login: (email, userData) => set({ user: userData, firstLogin: true }),
  changedPassword: () => set({ firstLogin: false }),
  logout: () => {
    clearSession();
    set({ user: null });
  },
  loadFromToken: () => {
    if (typeof window === "undefined") return;

    const token = getToken();
    if (!validateToken(token)) {
      clearSession();
      set({ user: null });
      return;
    }

    const userData = window.localStorage.getItem("tqi_user");
    if (!userData) {
      set({ user: null });
      return;
    }

    try {
      const user = JSON.parse(userData);
      set({ user });
    } catch {
      clearSession();
      set({ user: null });
    }
  },
}));

// Helper functions to check user role
export function isAdmin(role?: string): boolean {
  if (!role) return false;
  const adminRoles = ["SUPER_ADMIN", "CLUSTER_ADMIN"];
  return adminRoles.includes(role.toUpperCase());
}

export function isVolunteer(role?: string): boolean {
  if (!role) return false;
  return role.toUpperCase() === "VOLUNTEER";
}

export function isSuperAdmin(role?: string): boolean {
  if (!role) return false;
  return role.toUpperCase() === "SUPER_ADMIN";
}

export function isClusterAdmin(role?: string): boolean {
  if (!role) return false;
  return role.toUpperCase() === "CLUSTER_ADMIN";
}
