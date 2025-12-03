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
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { closeAllTooltips } from "./EventBlock";

const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key";
const GEMINI_API_KEY_VALID_KEY = "gemini_api_key_valid";

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
}

export function getGeminiApiKey(): string | null {
  return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
}

export function SettingsModal({
  isOpen,
  onClose,
  isRevoking,
  onRevokeAccount,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(GEMINI_API_KEY_VALID_KEY);
    return stored === null ? null : stored === "true";
  });

  // Read stored key on each render to get current state
  const storedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);

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
            localStorage.setItem(GEMINI_API_KEY_VALID_KEY, String(valid));
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
      onClose();
    } else {
      // Reset state when opening
      setApiKey("");
      setShowApiKey(false);
      setRemoved(false);
      setShowRevokeDialog(false);
      // Re-read validation status from storage
      const stored = localStorage.getItem(GEMINI_API_KEY_VALID_KEY);
      setIsKeyValid(stored === null ? null : stored === "true");
    }
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

    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, keyToSave);
    localStorage.setItem(GEMINI_API_KEY_VALID_KEY, String(isValid));
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
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    localStorage.removeItem(GEMINI_API_KEY_VALID_KEY);
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
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Gemini API Key
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
              Draft invitations faster with AI—just add your key, stored locally
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
                    className="flex-1 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600"
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
