import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  useUnreadCount,
  type NotificationRow,
} from "@/features/notifications/hooks/use-notifications";

export function NotificationsBell() {
  useNotificationsRealtime();
  const { data: unread = 0 } = useUnreadCount();
  const { data: items = [], isLoading } = useNotifications(20);
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const navigate = useNavigate();

  async function handleClick(n: NotificationRow) {
    if (!n.read_at) {
      try {
        await markOne.mutateAsync(n.id);
      } catch {
        /* silent */
      }
    }
    if (n.link_path) {
      navigate({ to: n.link_path });
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifikasi" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notifikasi</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Tandai semua dibaca
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">Memuat...</div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Belum ada notifikasi.
            </div>
          )}
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex gap-2 ${
                    !n.read_at ? "bg-accent/40" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                      !n.read_at ? "bg-primary" : "bg-transparent"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: localeId,
                      })}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
