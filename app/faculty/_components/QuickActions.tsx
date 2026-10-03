import { Card, CardContent } from "@/components/ui/card"
import { Plus, FileText, CalendarDays, User } from "lucide-react"
import Link from "next/link"

interface QuickAction {
  title: string
  description: string
  icon: any
  href?: string
  onClick?: () => void
  color: string
}

interface QuickActionsProps {
  actions: QuickAction[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => {
          const cardContent = (
            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-card border-border">
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-4`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-card-foreground">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          )

          return action.onClick ? (
            <button key={index} onClick={action.onClick} className="text-left">
              {cardContent}
            </button>
          ) : (
            <Link key={index} href={action.href || '#'}>
              {cardContent}
            </Link>
          )
        })}
      </div>
    </div>
  )
}