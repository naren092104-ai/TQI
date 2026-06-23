import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { clearSession, getToken, validateToken } from "@/utils/auth";

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
  const [authChecked, setAuthChecked] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const token = getToken();
    authLoad();

    if (!token || !validateToken(token)) {
      clearSession();
      useAuth.getState().logout();
      useStore.getState().reset();
      if (token) {
        toast.error("Session expired. Please login again");
      }
      if (router.state.location.pathname !== "/login") {
        router.navigate({ to: "/login" });
      }
      setAuthChecked(true);
      return;
    }

    if (router.state.location.pathname === "/login") {
      void init().finally(() => {
        setAuthChecked(true);
        router.navigate({ to: "/" });
      });
      return;
    }

    void init().finally(() => {
      setAuthChecked(true);
    });
  }, [authLoad, init, router]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      useAuth.getState().logout();
      useStore.getState().reset();
      toast.error("Session expired. Please login again");
      if (router.state.location.pathname !== "/login") {
        router.navigate({ to: "/login" });
      }
    };

    window.addEventListener("tqi:session-expired", handleSessionExpired);
    return () => window.removeEventListener("tqi:session-expired", handleSessionExpired);
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-2xl border border-input/50 bg-surface p-8 text-center shadow-lg">
          <p className="text-base font-medium text-foreground">Checking authentication...</p>
          <p className="mt-2 text-sm text-muted-foreground">Please wait while we verify your session.</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
