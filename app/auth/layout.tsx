"use client"

import { useUI } from "@/contexts/UIContext"
import { cn } from "@/lib/utils"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { textSizeEnlarged } = useUI()

  return (
    <div className={cn(textSizeEnlarged && "text-enlarged")}>
      {children}
    </div>
  )
}
