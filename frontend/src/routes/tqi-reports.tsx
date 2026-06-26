import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/tqi-reports")({
  head: () => ({ meta: [{ title: "TQI Reports — TQI Admin" }] }),
  component: () => <Outlet />,
});
