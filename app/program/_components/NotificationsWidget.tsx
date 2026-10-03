import { Bell, Megaphone } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface WidgetNotification {
  id: string
  title: string
  message: string
  type: string
  created_at: string
}

interface NotificationsWidgetProps {
  notifications?: WidgetNotification[]
}

export function NotificationsWidget({ notifications }: NotificationsWidgetProps) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3.5 border-b border-slate-200 dark:border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Megaphone size={16} strokeWidth={1.75} className="text-slate-800 dark:text-slate-200" />
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.01em]">
            Announcements
          </h2>
        </div>
        {!!notifications?.length && (
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-full px-2 py-0.5">
            {notifications.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {!notifications?.length ? (
          <div className="py-8 text-center">
            <Bell size={32} strokeWidth={1.5} className="block mx-auto mb-2 opacity-40 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground m-0 mb-0.5">All caught up!</p>
            <p className="text-xs text-muted-foreground m-0 opacity-70">No new announcements</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className="flex gap-3 p-4 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 hover:bg-white dark:hover:bg-card hover:shadow-sm transition-all duration-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground m-0 mb-[3px]">{n.title}</p>
                  <p className="text-xs text-muted-foreground m-0 mb-1.5 leading-[1.55] line-clamp-2">{n.message}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-all duration-200 cursor-pointer">
                      Read more &rarr;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
