import { useState } from "react";
import { toast } from "sonner";
import type { OutlookStatus } from "@/services/api/calendar";
import { calendarApi } from "@/services/api/calendar";
import { API_BASE_URL } from "@/config/api";

export interface UseOutlookConnectionReturn {
  outlookStatus: OutlookStatus;
  showOutlookSubmenu: boolean;
  setShowOutlookSubmenu: (show: boolean) => void;
  checkOutlookStatus: () => Promise<void>;
  handleConnectOutlook: () => void;
  handleRemoveOutlook: () => Promise<void>;
}

export interface UseOutlookConnectionProps {
  refreshEvents: () => Promise<void>;
}

/**
 * Custom hook for managing Outlook calendar connection
 * @param refreshEvents - Function to refresh calendar events from context
 */
export function useOutlookConnection({
  refreshEvents,
}: UseOutlookConnectionProps): UseOutlookConnectionReturn {
  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus>({
    connected: false,
  });
  const [showOutlookSubmenu, setShowOutlookSubmenu] = useState(false);

  // Check Outlook connection status
  const checkOutlookStatus = async () => {
    try {
      const status = await calendarApi.getOutlookStatus();
      setOutlookStatus(status);
    } catch (error) {
      console.error("Failed to check Outlook status:", error);
    }
  };

  // Connect Outlook (redirects to auth)
  const handleConnectOutlook = () => {
    window.location.href = `${API_BASE_URL}/api/auth/outlook`;
  };

  // Remove Outlook connection
  const handleRemoveOutlook = async () => {
    if (!outlookStatus.userId) return;

    // Close the submenu immediately
    setShowOutlookSubmenu(false);

    try {
      await calendarApi.removeOutlook(outlookStatus.userId);

      // Update state to show disconnected
      setOutlookStatus({
        connected: false,
        email: undefined,
        userId: undefined,
      });
      // Refresh events to remove Outlook events
      await refreshEvents();
    } catch (error) {
      console.error("Failed to disconnect Outlook Calendar:", error);
      toast.error("Failed to disconnect Outlook Calendar");
    }
  };

  return {
    outlookStatus,
    showOutlookSubmenu,
    setShowOutlookSubmenu,
    checkOutlookStatus,
    handleConnectOutlook,
    handleRemoveOutlook,
  };
}
