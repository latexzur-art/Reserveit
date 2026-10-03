import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Clock, Bell } from "lucide-react"
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

const typeConfig = {
  info: { icon: AlertCircle, colors: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800', iconColor: 'text-blue-600 dark:text-blue-400', textColor: 'text-blue-900 dark:text-blue-100', bodyColor: 'text-blue-700 dark:text-blue-300' },
  success: { icon: CheckCircle, colors: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800', iconColor: 'text-green-600 dark:text-green-400', textColor: 'text-green-900 dark:text-green-100', bodyColor: 'text-green-700 dark:text-green-300' },
  warning: { icon: Clock, colors: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800', iconColor: 'text-yellow-600 dark:text-yellow-400', textColor: 'text-yellow-900 dark:text-yellow-100', bodyColor: 'text-yellow-700 dark:text-yellow-300' },
  error: { icon: AlertCircle, colors: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', iconColor: 'text-red-600 dark:text-red-400', textColor: 'text-red-900 dark:text-red-100', bodyColor: 'text-red-700 dark:text-red-300' },
}

export function NotificationsWidget({ notifications }: NotificationsWidgetProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <AlertCircle className="w-5 h-5" />
          Announcements
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Important updates and notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(n => {
              const config = typeConfig[n.type as keyof typeof typeConfig] ?? typeConfig.info
              const Icon = config.icon
              return (
                <div key={n.id} className={`p-4 border rounded-lg ${config.colors}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium ${config.textColor}`}>{n.title}</h4>
                      <p className={`text-sm mt-1 ${config.bodyColor}`}>{n.message}</p>
                      <p className={`text-xs mt-1 opacity-70 ${config.bodyColor}`}>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
