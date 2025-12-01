import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  RefreshCw,
  LogOut,
  ChevronDown,
  Cloud,
  Mail,
  Settings,
} from "lucide-react";
import type { User } from "../types";
import type { UseICloudConnectionReturn } from "../hooks/useICloudConnection";
import type { UseOutlookConnectionReturn } from "../hooks/useOutlookConnection";

interface UserProfileDropdownProps {
  currentUser: User;
  isLoadingEvents: boolean;
  iCloudConnection: UseICloudConnectionReturn;
  outlookConnection: UseOutlookConnectionReturn;
  onRefreshEvents: () => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
}

export function UserProfileDropdown({
  currentUser,
  isLoadingEvents,
  iCloudConnection,
  outlookConnection,
  onRefreshEvents,
  onSignOut,
  onOpenSettings,
}: UserProfileDropdownProps) {
  const {
    iCloudStatus,
    showICloudSubmenu,
    setShowICloudModal,
    setShowICloudSubmenu,
    handleRemoveICloud,
  } = iCloudConnection;

  const {
    outlookStatus,
    showOutlookSubmenu,
    setShowOutlookSubmenu,
    handleConnectOutlook,
    handleRemoveOutlook,
  } = outlookConnection;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 w-full sm:w-auto hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {currentUser.name}
          </span>
          <span className="text-xs text-gray-500">{currentUser.email}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500 ml-auto sm:ml-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-56">
        <DropdownMenuItem
          onClick={onRefreshEvents}
          className="cursor-pointer"
          disabled={isLoadingEvents}
        >
          <RefreshCw className="size-4" />
          <span>
            {isLoadingEvents ? "Loading..." : "Reload Calendar events"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* iCloud Menu */}
        {!iCloudStatus.connected ? (
          <DropdownMenuItem
            onClick={() => setShowICloudModal(true)}
            className="cursor-pointer"
          >
            <Cloud className="size-4" />
            <span>Connect iCloud Calendar</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenu
            open={showICloudSubmenu}
            onOpenChange={setShowICloudSubmenu}
          >
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 gap-3 text-sm outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50 data-[state=open]:bg-gray-50 text-gray-900 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                type="button"
              >
                <Cloud className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-left">
                  iCloud ({iCloudStatus.email?.split("@")[0] || "account"})
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              className="w-56 shadow-lg"
              sideOffset={8}
            >
              <DropdownMenuItem
                onClick={() => {
                  setShowICloudModal(true);
                  setShowICloudSubmenu(false);
                }}
                className="cursor-pointer"
              >
                <RefreshCw className="size-4" />
                <span>Change account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveICloud}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="size-4" />
                <span>Remove connection</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenuSeparator />

        {/* Outlook Menu */}
        {!outlookStatus.connected ? (
          <DropdownMenuItem
            onClick={handleConnectOutlook}
            className="cursor-pointer"
          >
            <Mail className="size-4" />
            <span>Connect Outlook Calendar</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenu
            open={showOutlookSubmenu}
            onOpenChange={setShowOutlookSubmenu}
          >
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 gap-3 text-sm outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50 data-[state=open]:bg-gray-50 text-gray-900 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                type="button"
              >
                <Mail className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-left">
                  Outlook ({outlookStatus.email?.split("@")[0] || "account"})
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              className="w-56 shadow-lg"
              sideOffset={8}
            >
              <DropdownMenuItem
                onClick={() => {
                  handleConnectOutlook();
                  setShowOutlookSubmenu(false);
                }}
                className="cursor-pointer"
              >
                <RefreshCw className="size-4" />
                <span>Change account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveOutlook}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="size-4" />
                <span>Remove connection</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenuSeparator />

        {/* Settings Menu Item */}
        <DropdownMenuItem onClick={onOpenSettings} className="cursor-pointer">
          <Settings className="size-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
