import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getAuthToken } from "@/lib/api/auth";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TQI Super Admin — Talent Quest for India" },
      { name: "description", content: "Command center for the Talent Quest for India NGO program — manage clusters, schools, students, finance and more." },
      { name: "author", content: "Talent Quest for India" },
      { property: "og:title", content: "TQI Super Admin — Talent Quest for India" },
      { property: "og:description", content: "Premium command center for the TQI NGO program." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const init = useStore((s) => s.init);
  const authLoad = useAuth((s) => s.loadFromToken);
  const router = useRouter();
  const token = getAuthToken();
  const [authChecked, setAuthChecked] = useState(false);

  console.log("Root component - token check:", token ? "Token found" : "No token");

  useEffect(() => {
    console.log("Auth effect running - token:", token ? "present" : "missing", "location:", router.state.location.pathname);

    // Load auth state from localStorage
    authLoad();

    if (token && router.state.location.pathname === "/login") {
      console.log("Redirecting from login to dashboard");
      router.navigate({ to: "/" });
      return;
    }

    if (!token && router.state.location.pathname !== "/login") {
      console.log("Redirecting to login - no token");
      router.navigate({ to: "/login" });
      return;
    }

    if (token) {
      console.log("Token found, initializing store");
      void init();
    }

    setAuthChecked(true);
  }, [init, router, token, authLoad]);

  useEffect(() => {
    if (!token) return;
    const retry = window.setInterval(() => {
      if (!useStore.getState().initialized) {
        void useStore.getState().init();
      }
    }, 5000);
    return () => window.clearInterval(retry);
  }, [token]);

  if (!authChecked) {
    return null; // Don't render anything until auth is checked
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
