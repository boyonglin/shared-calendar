import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ExternalLink, Eye, EyeOff, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function getGeminiApiKey(): string | null {
  return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [removed, setRemoved] = useState(false);

  // Read stored key on each render to get current state
  const storedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);

  // Track key state accounting for removal action
  const effectiveStoredKey = removed ? null : storedKey;
  const effectiveHasExistingKey = !!effectiveStoredKey;

  // Check if key has been modified (new key entered)
  const hasNewKey = apiKey.trim().length > 0;

  // Reset state when opening or closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setApiKey("");
      setShowApiKey(false);
      setRemoved(false);
      onClose();
    } else {
      // Reset state when opening
      setApiKey("");
      setShowApiKey(false);
      setRemoved(false);
    }
  };

  const handleSave = () => {
    const keyToSave = apiKey.trim();
    if (!keyToSave) {
      toast.error("Please enter a valid API key");
      return;
    }

    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, keyToSave);
    setRemoved(false);
    toast.success("Gemini API key saved successfully");
    onClose();
  };

  const handleRemove = () => {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    setApiKey("");
    setRemoved(true);
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
            Configure your API keys and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Gemini API Key
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Add your own Gemini API key to enable AI-powered invitation
                drafts.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">API Key</Label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  API key configured: {maskApiKey(effectiveStoredKey)}
                </p>
              )}
              {!effectiveHasExistingKey && (
                <p className="text-xs text-gray-500">
                  Don&apos;t have an API key?{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Get one from Google AI Studio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800 text-sm">
              <strong>Security Notice:</strong> Your API key is stored in your
              browser&apos;s localStorage, which may be accessible to scripts on
              this page. Only use this feature on trusted devices. The key is
              only sent when generating AI drafts.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-between">
          <div>
            {effectiveHasExistingKey && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!apiKey.trim() || !hasNewKey}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
