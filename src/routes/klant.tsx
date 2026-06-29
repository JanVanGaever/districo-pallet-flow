import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/klant")({
  ssr: false,
  component: () => <Outlet />,
});
