import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { RefreshCw, LogOut, ChevronDown, Cloud } from 'lucide-react';
import { User } from '../types';
import { UseICloudConnectionReturn } from '../hooks/useICloudConnection';

interface UserProfileDropdownProps {
  currentUser: User;
  isLoadingEvents: boolean;
  iCloudConnection: UseICloudConnectionReturn;
  onRefreshEvents: () => void;
  onSignOut: () => void;
}

export function UserProfileDropdown({
  currentUser,
  isLoadingEvents,
  iCloudConnection,
  onRefreshEvents,
  onSignOut,
}: UserProfileDropdownProps) {
  const {
    iCloudStatus,
    showICloudSubmenu,
    setShowICloudModal,
    setShowICloudSubmenu,
    handleRemoveICloud,
  } = iCloudConnection;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">{currentUser.name}</span>
          <span className="text-xs text-gray-500">{currentUser.email}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={onRefreshEvents}
          className="cursor-pointer"
          disabled={isLoadingEvents}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          <span>{isLoadingEvents ? 'Loading...' : 'Reload Calendar events'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* iCloud Menu */}
        {!iCloudStatus.connected ? (
          <DropdownMenuItem onClick={() => setShowICloudModal(true)} className="cursor-pointer">
            <Cloud className="w-4 h-4 mr-2" />
            <span>Connect iCloud Calendar</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenu open={showICloudSubmenu} onOpenChange={setShowICloudSubmenu}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 gap-2 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 text-gray-900"
                type="button"
              >
                <Cloud className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>iCloud ({iCloudStatus.email?.split('@')[0] || 'account'})</span>
                <ChevronDown className="w-3 h-3 ml-auto text-gray-600" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="center"
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
                <RefreshCw className="w-4 h-4 mr-2" />
                <span>Change account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveICloud}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Remove connection</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
