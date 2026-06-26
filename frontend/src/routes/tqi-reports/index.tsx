import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isClusterAdmin, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/tqi-reports/")({
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (isClusterAdmin(user?.role)) {
      nav({ to: "/tqi-reports/create" });
    } else {
      nav({ to: "/tqi-reports/submitted" });
    }
  }, [user, nav]);

  return null;
}
