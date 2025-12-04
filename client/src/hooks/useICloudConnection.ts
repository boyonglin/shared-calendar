import { useState } from "react";
import { toast } from "sonner";
import type { ICloudStatus } from "@/services/api/calendar";
import { calendarApi } from "@/services/api/calendar";

export interface UseICloudConnectionReturn {
  iCloudStatus: ICloudStatus;
  showICloudModal: boolean;
  showICloudSubmenu: boolean;
  setShowICloudModal: (show: boolean) => void;
  setShowICloudSubmenu: (show: boolean) => void;
  checkICloudStatus: () => Promise<void>;
  handleRemoveICloud: () => Promise<void>;
  handleICloudConnectSuccess: () => void;
}

export interface UseICloudConnectionProps {
  refreshEvents: () => Promise<void>;
}

/**
 * Custom hook for managing iCloud calendar connection
 * @param refreshEvents - Function to refresh calendar events from context
 */
export function useICloudConnection({
  refreshEvents,
}: UseICloudConnectionProps): UseICloudConnectionReturn {
  const [showICloudModal, setShowICloudModal] = useState(false);
  const [iCloudStatus, setICloudStatus] = useState<ICloudStatus>({
    connected: false,
  });
  const [showICloudSubmenu, setShowICloudSubmenu] = useState(false);

  // Check iCloud connection status
  const checkICloudStatus = async () => {
    try {
      const status = await calendarApi.getICloudStatus();
      setICloudStatus(status);
    } catch (error) {
      console.error("Failed to check iCloud status:", error);
    }
  };

  // Remove iCloud connection
  const handleRemoveICloud = async () => {
    if (!iCloudStatus.userId) return;

    // Close the submenu immediately
    setShowICloudSubmenu(false);

    try {
      await calendarApi.removeICloud(iCloudStatus.userId);

      // Update state to show disconnected
      setICloudStatus({
        connected: false,
        email: undefined,
        userId: undefined,
      });
      // Refresh events to remove iCloud events
      await refreshEvents();
    } catch (error) {
      console.error("Failed to disconnect iCloud Calendar:", error);
      toast.error("Failed to disconnect iCloud Calendar");
    }
  };

  const handleICloudConnectSuccess = () => {
    checkICloudStatus();
    refreshEvents();
  };

  return {
    iCloudStatus,
    showICloudModal,
    showICloudSubmenu,
    setShowICloudModal,
    setShowICloudSubmenu,
    checkICloudStatus,
    handleRemoveICloud,
    handleICloudConnectSuccess,
  };
}
