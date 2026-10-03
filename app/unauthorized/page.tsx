"use client"

import { useAuth } from "@/contexts/AuthContext"
import { useUI } from "@/contexts/UIContext"
import { Button } from "@/components/ui/button"
import { ShieldX, Home, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export default function UnauthorizedPage() {
  const { user, signOut, isAuthenticated } = useAuth()
  const { textSizeEnlarged } = useUI()

  return (
    <main className={cn("min-h-screen bg-background flex items-center justify-center p-4", textSizeEnlarged && "text-enlarged")}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">Access Denied</h1>

        <p className="text-muted-foreground mb-6">
          {isAuthenticated
            ? "Your account does not have the required permissions to access this page. Please contact your administrator if you believe this is an error."
            : "You need to sign in to access this page."}
        </p>

        {isAuthenticated && user && (
          <div className="bg-card rounded-lg shadow-sm p-4 mb-6 text-left">
            <p className="text-sm text-muted-foreground mb-1">Signed in as:</p>
            <p className="font-medium text-card-foreground">{user.fullName || user.email}</p>
            {user.roles && user.roles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground mb-1">Your roles:</p>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <span key={role.id} className="px-2 py-1 bg-muted text-xs rounded text-muted-foreground">
                      {role.displayName || role.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(!user.roles || user.roles.length === 0) && (
              <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                No roles assigned. Please contact the IT Admin.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <a href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </a>
          </Button>

          {isAuthenticated && (
            <Button onClick={signOut} variant="destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
