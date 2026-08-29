import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { myRolesQueryOptions } from "@/hooks/use-my-roles";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (data.user.app_metadata?.must_change_password === true) {
      throw redirect({ to: "/change-password" });
    }
    // Prime roles cache so sidebar renders instantly
    await context.queryClient.ensureQueryData(myRolesQueryOptions);
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  // Move focus to the main region on route change so keyboard/screen-reader
  // users start from the new page's content, not a stale control.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Suspense fallback={<div className="w-64" />}>
          <AppSidebar />
        </Suspense>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-background px-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <div className="min-w-0 overflow-x-auto">
                <AppBreadcrumb />
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="hidden lg:inline text-sm text-muted-foreground truncate max-w-[16rem]">
                {user.email}
              </span>
              <NotificationsBell />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </header>
          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="flex-1 outline-none"
          >
            <Suspense
              fallback={
                <div className="p-6 text-sm text-muted-foreground">
                  Memuat...
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
