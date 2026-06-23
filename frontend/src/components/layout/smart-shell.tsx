/**
 * SmartShell — renders ClusterAdminShell for Cluster Admins,
 * AppShell for everyone else.
 * Import this instead of AppShell in any route that both roles can visit.
 */
import { useAuth, isClusterAdmin } from "@/lib/auth";
import { ClusterAdminShell, ClusterPageHeader } from "./cluster-admin-shell";
import { AppShell as SuperAdminShell, PageHeader as SuperPageHeader } from "./app-shell";

interface ShellProps {
  children: React.ReactNode;
}

export function SmartShell({ children }: ShellProps) {
  const { user } = useAuth();
  return isClusterAdmin(user?.role)
    ? <ClusterAdminShell>{children}</ClusterAdminShell>
    : <SuperAdminShell>{children}</SuperAdminShell>;
}

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: string;
}

export function SmartPageHeader(props: HeaderProps) {
  const { user } = useAuth();
  return isClusterAdmin(user?.role)
    ? <ClusterPageHeader {...props} />
    : <SuperPageHeader {...props} />;
}
