import { useState, useEffect } from "react";
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
import { ExternalLink, Loader2 } from "lucide-react";
import { authApi } from "@/services/api/auth";
import { closeAllTooltips } from "./EventBlock";

interface ICloudConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}

export function ICloudConnectModal({
  isOpen,
  onClose,
  onSuccess,
}: ICloudConnectModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Close all tooltips when modal opens
  useEffect(() => {
    if (isOpen) {
      closeAllTooltips();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const fullEmail = `${email}@icloud.com`;
      const data = await authApi.connectICloud({ email: fullEmail, password });

      // Success
      onSuccess(data.user.id);
      setEmail("");
      setPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect iCloud Calendar</DialogTitle>
          <DialogDescription>
            Enter your Apple ID and App-Specific Password to connect your iCloud
            calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apple-id">Apple ID</Label>
            <div className="flex items-center">
              <Input
                id="apple-id"
                type="text"
                placeholder="your.apple.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input"
              />
              <span className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground">
                @icloud.com
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-password">App-Specific Password</Label>
            <Input
              id="app-password"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Don&apos;t have an App-Specific Password?{" "}
              <a
                href="https://support.apple.com/en-us/HT204397"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Learn how to create one
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
