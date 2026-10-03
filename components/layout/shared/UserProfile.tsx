'use client'

import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, LogOut, Bell, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { userRoleLabel } from "@/lib/enum-labels";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ROUTES } from '@/lib/routes'

interface UserProfileProps {
  settingsRoute?: string;
  messagesRoute?: string;
  notificationsRoute?: string;
}

export const UserProfile = ({
  settingsRoute,
  messagesRoute,
  notificationsRoute,
}: UserProfileProps = {}) => {
  const router = useRouter();
  const { user, signOut, isAuthenticated } = useAuth();

  // Helper to format role names cleanly (e.g. "external_client" -> "External Client")
  const getRoleDisplayName = (role: any): string => {
    if (!role) return "External Client";
    if (typeof role === "object" && role.displayName) return role.displayName;
    if (typeof role === "object" && role.name) role = role.name;
    if (typeof role === "string") {
      return userRoleLabel(role);
    }
    return "External Client";
  };

  // Determine user display name & email safely
  const displayName = user?.fullName || (isAuthenticated ? "Client User" : "Guest Account");
  const displayEmail = user?.email || (isAuthenticated ? "No email provided" : "Not signed in");
  const displayAvatar = user?.avatarUrl || "";
  
  // Get the display name of the primary role safely without defaulting to "Administrator"
  const roleDisplay = user?.roles?.[0]
    ? getRoleDisplayName(user.roles[0])
    : (user?.userType === 'internal' ? 'Staff Member' : 'External Client');

  // Determine role-based routes with fallback defaults
  const userRoles = user?.roles?.map((r: any) => (typeof r === 'string' ? r : r.name)) || [];

  const getRoleRoutes = () => {
    if (userRoles.includes('building_admin')) {
      return {
        settings: ROUTES.buildingAdmin.settings,
        messages: ROUTES.buildingAdmin.messages,
        notifications: ROUTES.buildingAdmin.notifications,
      };
    }
    if (userRoles.includes('it_admin')) {
      return {
        settings: '/admin/settings',
        messages: '/admin/users',
        notifications: '/admin/users',
      };
    }
    if (userRoles.includes('program_head')) {
      return {
        settings: ROUTES.program.profile,
        messages: ROUTES.program.dashboard,
        notifications: ROUTES.program.notifications,
      };
    }
    if (userRoles.includes('faculty')) {
      return {
        settings: ROUTES.faculty.profile,
        messages: ROUTES.faculty.dashboard,
        notifications: ROUTES.faculty.notifications,
      };
    }
    if (userRoles.includes('external_client')) {
      return {
        settings: ROUTES.client.profile,
        messages: ROUTES.client.dashboard,
        notifications: ROUTES.client.notifications,
      };
    }
    return {
      settings: ROUTES.client.profile,
      messages: ROUTES.client.dashboard,
      notifications: ROUTES.client.notifications,
    };
  };

  const roleRoutes = getRoleRoutes();
  const effectiveSettingsRoute = settingsRoute || roleRoutes.settings;
  const effectiveMessagesRoute = messagesRoute || roleRoutes.messages;
  const effectiveNotificationsRoute = notificationsRoute || roleRoutes.notifications;

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="outline-none border-none bg-transparent block group">
          <div className="relative cursor-pointer flex items-center justify-center">
            <Avatar className="h-9 w-9 border border-border/40 group-hover:border-yellow-500 dark:group-hover:border-blue-500 transition-all duration-300 bg-transparent">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="bg-transparent text-muted-foreground group-hover:text-foreground transition-colors">
                <User size={18} strokeWidth={2.5} />
              </AvatarFallback>
            </Avatar>
          </div>
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-72 mt-3 rounded-[1.5rem] shadow-2xl border-border/40 bg-white dark:bg-[#1A1D21] p-2 z-[100] animate-in zoom-in-95 duration-200" 
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal p-4">
          <div className="flex flex-col space-y-2">
            {/* DYNAMIC FULL NAME */}
            <p className="text-xs font-black leading-none uppercase tracking-tighter text-foreground">
              {displayName}
            </p>
            {/* DYNAMIC EMAIL */}
            <p className="text-[10px] leading-none text-muted-foreground font-bold truncate tracking-tight">
              {displayEmail}
            </p>
            {/* DYNAMIC ROLE BADGE */}
            <div className="pt-2">
              <span className="bg-yellow-500/10 text-yellow-600 dark:bg-blue-600/10 dark:text-blue-500 text-[8px] font-black uppercase px-2.5 py-1 rounded-full tracking-[0.2em]">
                {roleDisplay}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="opacity-40 mx-2" />
        
        <DropdownMenuGroup className="p-1 space-y-1">
          <DropdownMenuItem 
            onClick={() => router.push(effectiveMessagesRoute)} 
            className="rounded-xl cursor-pointer text-[10px] font-black uppercase tracking-widest py-3 px-3 flex justify-between items-center group/item focus:bg-accent/50"
          >
            <div className="flex items-center">
              <Mail className="mr-3 h-4 w-4 opacity-50" /> 
              <span>Messages Center</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => router.push(effectiveNotificationsRoute)} 
            className="rounded-xl cursor-pointer text-[10px] font-black uppercase tracking-widest py-3 px-3 flex justify-between items-center group/item focus:bg-accent/50"
          >
            <div className="flex items-center">
              <Bell className="mr-3 h-4 w-4 opacity-50" /> 
              <span>Notifications</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => router.push(effectiveSettingsRoute)} 
            className="rounded-xl cursor-pointer text-[10px] font-black uppercase tracking-widest py-3 px-3 focus:bg-accent/50"
          >
            <Settings className="mr-3 h-4 w-4 opacity-50" /> 
            <span>Account Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator className="opacity-40 mx-2" />
        
        <div className="p-1">
          <DropdownMenuItem 
            onClick={handleLogout}
            className="rounded-xl text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer text-[10px] font-black uppercase tracking-widest py-3 px-3 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4" /> 
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};