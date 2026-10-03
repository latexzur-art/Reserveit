import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface QuickAction {
  title: string
  description: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3.5 border-b border-slate-200 dark:border-border shadow-sm">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.01em]">
          Quick Actions
        </h2>
      </div>

      {/* Action card list */}
      <div className="flex flex-col gap-1.5 pt-2.5 px-3 pb-3">
        {actions.map((action, i) => {
          const content = (
            <>
              {/* Icon container */}
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <action.icon size={18} strokeWidth={1.75} className="text-slate-900 dark:text-slate-100" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 mb-0.5 leading-[1.3]">
                  {action.title}
                </p>
                <p className="text-xs font-normal text-slate-400 dark:text-slate-500 m-0 leading-[1.4]">
                  {action.description}
                </p>
              </div>

              {/* Chevron */}
              <ChevronRight
                size={20}
                strokeWidth={1.75}
                className="text-slate-900 dark:text-slate-100 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
              />
            </>
          )

          const commonClassName = "group flex items-center gap-[14px] py-3 px-3.5 rounded-[10px] bg-slate-50 dark:bg-muted/50 no-underline cursor-pointer border border-transparent border-l-2 transition-all duration-200 hover:bg-white dark:hover:bg-card hover:border-l-slate-900 dark:hover:border-l-slate-100 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"

          return action.onClick ? (
            <button key={i} onClick={action.onClick} className={`${commonClassName} w-full`}>
              {content}
            </button>
          ) : (
            <Link key={i} href={action.href || "#"} className={commonClassName}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
