import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — TQI Admin" }] }),
  component: Page,
});

function Page() {
  const router = useRouter();
  
  useEffect(() => {
    router.navigate({ to: "/attendance/students" });
  }, [router]);

  return null;
}
