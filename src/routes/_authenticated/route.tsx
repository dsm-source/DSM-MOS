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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, UserRound } from "lucide-react";
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

const pageLoadingSkeleton = (
  <div className="p-6 space-y-6" aria-busy="true" aria-label="Memuat halaman">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    aria-label="Menu akun"
                  >
                    <UserRound className="h-4 w-4" />
                    <span className="hidden lg:inline truncate max-w-[12rem]">
                      {user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="max-w-[16rem] truncate text-xs font-normal text-muted-foreground lg:hidden">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="lg:hidden" />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirmSignOut(true);
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Keluar dari DSM MOS?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sesi Anda akan diakhiri dan Anda perlu masuk kembali.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="flex-1 outline-none"
          >
            <Suspense fallback={pageLoadingSkeleton}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
