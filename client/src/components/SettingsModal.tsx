import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { closeAllTooltips } from "./EventBlock";
import { STORAGE_KEYS, CALENDAR_DEFAULTS } from "@/constants/storage";

// Re-export for backward compatibility
export const CALENDAR_START_HOUR_KEY = STORAGE_KEYS.CALENDAR_START_HOUR;
export const CALENDAR_END_HOUR_KEY = STORAGE_KEYS.CALENDAR_END_HOUR;
export const DEFAULT_START_HOUR = CALENDAR_DEFAULTS.START_HOUR;
export const DEFAULT_END_HOUR = CALENDAR_DEFAULTS.END_HOUR;

/**
 * Validate API key by making a simple request to Gemini API.
 * Note: This sends the API key to Google's servers for verification.
 * The key is sent in the X-Goog-Api-Key header, not as a URL parameter.
 */
async function validateGeminiApiKey(
  apiKey: string,
  signal?: AbortSignal,
): Promise<boolean> {
  // Basic format validation before making API call
  if (!apiKey || apiKey.length < 20) {
    return false;
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
        },
        signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRevoking?: boolean;
  onRevokeAccount?: () => Promise<void>;
  calendarStartHour?: number;
  calendarEndHour?: number;
  onCalendarHoursChange?: (startHour: number, endHour: number) => void;
}

export function getGeminiApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
}

export function SettingsModal({
  isOpen,
  onClose,
  isRevoking,
  onRevokeAccount,
  calendarStartHour = DEFAULT_START_HOUR,
  calendarEndHour = DEFAULT_END_HOUR,
  onCalendarHoursChange,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY_VALID);
    return stored === null ? null : stored === "true";
  });
  const [localStartHour, setLocalStartHour] = useState(calendarStartHour);
  const [localEndHour, setLocalEndHour] = useState(calendarEndHour);

  // Read stored key on each render to get current state
  const storedKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);

  // Close all tooltips when modal opens
  useEffect(() => {
    if (isOpen) {
      closeAllTooltips();
    }
  }, [isOpen]);

  // Track key state accounting for removal action
  const effectiveStoredKey = removed ? null : storedKey;
  const effectiveHasExistingKey = !!effectiveStoredKey;

  // Validate stored key on mount if we haven't validated yet
  useEffect(() => {
    if (effectiveStoredKey && isKeyValid === null) {
      const abortController = new AbortController();
      validateGeminiApiKey(effectiveStoredKey, abortController.signal).then(
        (valid) => {
          if (!abortController.signal.aborted) {
            setIsKeyValid(valid);
            localStorage.setItem(
              STORAGE_KEYS.GEMINI_API_KEY_VALID,
              String(valid),
            );
          }
        },
      );
      return () => {
        abortController.abort();
      };
    }
  }, [effectiveStoredKey, isKeyValid]);

  // Reset state when opening or closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setApiKey("");
      setShowApiKey(false);
      setRemoved(false);
      setShowRevokeDialog(false);
      setLocalStartHour(calendarStartHour);
      setLocalEndHour(calendarEndHour);
      onClose();
    } else {
      // Reset state when opening
      setApiKey("");
      setShowApiKey(false);
      setRemoved(false);
      setShowRevokeDialog(false);
      setLocalStartHour(calendarStartHour);
      setLocalEndHour(calendarEndHour);
      // Re-read validation status from storage
      const stored = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY_VALID);
      setIsKeyValid(stored === null ? null : stored === "true");
    }
  };

  const handleStartHourChange = (value: string) => {
    const hour = parseInt(value, 10);
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      setLocalStartHour(hour);
      if (hour > localEndHour) {
        setLocalEndHour(hour);
      }
    }
  };

  const handleEndHourChange = (value: string) => {
    const hour = parseInt(value, 10);
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      setLocalEndHour(hour);
      if (hour < localStartHour) {
        setLocalStartHour(hour);
      }
    }
  };

  const handleSaveCalendarHours = () => {
    localStorage.setItem(
      STORAGE_KEYS.CALENDAR_START_HOUR,
      String(localStartHour),
    );
    localStorage.setItem(STORAGE_KEYS.CALENDAR_END_HOUR, String(localEndHour));
    onCalendarHoursChange?.(localStartHour, localEndHour);
    toast.success("Calendar hours saved");
  };

  const handleSave = async () => {
    const keyToSave = apiKey.trim();
    if (!keyToSave) {
      toast.error("Please enter a valid API key");
      return;
    }

    // Validate the API key before saving
    setIsValidating(true);
    const isValid = await validateGeminiApiKey(keyToSave);
    setIsValidating(false);

    localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, keyToSave);
    localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY_VALID, String(isValid));
    setIsKeyValid(isValid);
    setRemoved(false);
    setApiKey("");

    if (isValid) {
      toast.success("Gemini API key saved successfully");
    } else {
      toast.warning("API key saved but appears to be invalid");
    }
  };

  const handleRemove = () => {
    localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
    localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY_VALID);
    setApiKey("");
    setRemoved(true);
    setIsKeyValid(null);
    toast.success("Gemini API key removed");
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your account preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Calendar Display Hours */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Calendar Display Hours
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
              Set the time range displayed in your calendar view.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label
                  htmlFor="start-hour"
                  className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >
                  Start Time
                </label>
                <Select
                  value={String(localStartHour)}
                  onValueChange={handleStartHourChange}
                >
                  <SelectTrigger id="start-hour" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label
                  htmlFor="end-hour"
                  className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >
                  End Time
                </label>
                <Select
                  value={String(localEndHour)}
                  onValueChange={handleEndHourChange}
                >
                  <SelectTrigger id="end-hour" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(localStartHour !== calendarStartHour ||
              localEndHour !== calendarEndHour) && (
              <Button onClick={handleSaveCalendarHours} className="w-full mt-3">
                Save Calendar Hours
              </Button>
            )}
          </div>

          {/* Gemini API Key */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Gemini API Key
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
              Draft invitations faster with AI—just add your key, stored safely
              in your browser.
            </p>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="gemini-api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder={
                    effectiveHasExistingKey
                      ? "Enter new key to replace"
                      : "Enter your Gemini API key"
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {effectiveHasExistingKey && effectiveStoredKey && (
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs flex items-center gap-1 ${isKeyValid === false ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
                  >
                    {isValidating ? (
                      "Validating..."
                    ) : isKeyValid === false ? (
                      <>
                        <span>
                          <AlertTriangle
                            className="w-3 h-3"
                            aria-label="API key appears to be invalid"
                          />
                        </span>
                        API key configured: {maskApiKey(effectiveStoredKey)}
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        API key configured: {maskApiKey(effectiveStoredKey)}
                      </>
                    )}
                  </p>
                </div>
              )}
              {!effectiveHasExistingKey && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Don&apos;t have an API key?{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Get one from Google AI Studio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              )}
              <div className="flex flex-row gap-2 pt-2">
                {effectiveHasExistingKey && (
                  <Button
                    type="button"
                    onClick={handleRemove}
                    className="flex-1 bg-red-600/70 dark:bg-red-700/60 text-white/90 hover:bg-red-600 hover:text-white dark:hover:bg-red-600"
                  >
                    Remove
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || isValidating}
                  className="flex-1"
                >
                  {isValidating ? "Validating..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {onRevokeAccount && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <h3 className="text-sm font-medium text-red-700 dark:text-red-400">
              Danger Zone
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-3">
              Permanently delete your account and all associated data.
            </p>
            <Button
              onClick={() => setShowRevokeDialog(true)}
              disabled={isRevoking}
              className="w-full bg-red-600/70 dark:bg-red-700/60 text-white/90 hover:bg-red-600 hover:text-white dark:hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isRevoking ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data,
              including your calendar connections, friend connections, and
              settings.
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (onRevokeAccount) {
                  try {
                    await onRevokeAccount();
                    setShowRevokeDialog(false);
                    onClose();
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : typeof error === "string"
                          ? error
                          : "Failed to delete account. Please try again.";
                    toast.error(message);
                  }
                }
              }}
              className="bg-red-600/70 dark:bg-red-700/60 text-white/90 hover:bg-red-600 hover:text-white dark:hover:bg-red-600"
            >
              {isRevoking ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
