import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const router = useRouter();

  useEffect(() => {
    if (router.state.location.pathname === "/attendance") {
      router.navigate({ to: "/attendance/students" });
    }
  }, [router]);

  return <Outlet />;
}
