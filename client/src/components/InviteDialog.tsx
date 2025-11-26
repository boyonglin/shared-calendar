import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import type { TimeSlot, User } from "../types";
import { Calendar, Clock, Sparkles } from "lucide-react";
import { generateInvitationDraft } from "../services/api/ai";
import { toast } from "sonner";
import { getGeminiApiKey } from "./SettingsModal";

interface InviteDialogProps {
  isOpen: boolean;
  timeSlot: TimeSlot | null;
  users: User[];
  onClose: () => void;
  onSendInvite: (
    title: string,
    description: string,
    attendees: string[],
    duration: number,
  ) => void;
  onOpenSettings?: () => void;
}

export function InviteDialog({
  isOpen,
  timeSlot,
  users,
  onClose,
  onSendInvite,
  onOpenSettings,
}: InviteDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [duration, setDuration] = useState("60");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState<"professional" | "casual" | "friendly">(
    "professional",
  );

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setSelectedAttendees([]);
      setDuration("60");
      setIsGenerating(false);
      setTone("professional");
    }
  }, [isOpen]);

  const handleAttendeeToggle = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSendInvite(title, description, selectedAttendees, parseInt(duration, 10));
  };

  // Helper to show API key error with settings link
  const showApiKeyError = (message: string) => {
    toast.error(
      <div className="flex flex-col gap-1">
        <span>{message}</span>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="text-left text-blue-500 hover:underline flex items-center gap-1 text-sm"
          >
            Add your API key in Settings
          </button>
        )}
      </div>,
      { duration: 5000 },
    );
  };

  const handleAIDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title first");
      return;
    }

    // Check timeSlot first before API key
    if (!timeSlot) {
      toast.error("No time slot selected");
      return;
    }

    // Check if API key is configured
    if (!getGeminiApiKey()) {
      showApiKeyError("Gemini API key not configured");
      return;
    }

    setIsGenerating(true);
    try {
      const { date, hour } = timeSlot;
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + parseInt(duration, 10));

      const attendeeNames = users
        .filter((u) => selectedAttendees.includes(u.id))
        .map((u) => u.name);

      const result = await generateInvitationDraft({
        title,
        description,
        start: start.toISOString(),
        end: end.toISOString(),
        attendees: attendeeNames,
        tone,
      });

      setDescription(result.draft);
      toast.success("Invitation draft generated!");
    } catch (error) {
      console.error("Failed to generate draft:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if it's an API key related error
      if (
        errorMessage.toLowerCase().includes("api key") ||
        errorMessage.toLowerCase().includes("not configured")
      ) {
        showApiKeyError(errorMessage);
      } else {
        toast.error(`Failed to generate draft: ${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateTime = () => {
    if (!timeSlot) return "";
    const { date, hour, minute = 0, isAllDay } = timeSlot;
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (isAllDay) {
      return `${dateStr} (All day)`;
    }
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const timeStr = `${displayHour}:${minute === 0 ? "00" : minute} ${hour >= 12 ? "PM" : "AM"}`;
    return `${dateStr} at ${timeStr}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Calendar Invite</DialogTitle>
          <DialogDescription>
            Schedule a meeting with your team members at the selected time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {timeSlot && (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDateTime()}</span>
              </div>
              {!timeSlot.isAllDay && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Duration:</span>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="e.g., Team Sync Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description (Optional)</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={tone}
                  onValueChange={(v) =>
                    setTone(v as "professional" | "casual" | "friendly")
                  }
                  disabled={isGenerating}
                >
                  <SelectTrigger
                    className="h-7 text-xs w-[110px]"
                    aria-label="Select tone for AI draft"
                  >
                    <SelectValue placeholder="Tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  onClick={handleAIDraft}
                  disabled={isGenerating || !title.trim()}
                >
                  <Sparkles className="w-3 h-3" />
                  {isGenerating ? "Drafting..." : "AI Draft"}
                </Button>
              </div>
            </div>
            <ScrollArea
              type="auto"
              className="min-h-[80px] max-h-[180px] rounded-md border"
            >
              <Textarea
                id="description"
                placeholder="Add meeting details, agenda, or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={2000}
              />
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Invite Attendees</Label>
            <ScrollArea type="auto" className="max-h-[180px] rounded-lg border">
              <div className="p-3 space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`attendee-${user.id}`}
                      checked={selectedAttendees.includes(user.id)}
                      onCheckedChange={() => handleAttendeeToggle(user.id)}
                    />
                    <label
                      htmlFor={`attendee-${user.id}`}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-gray-900 text-sm">{user.name}</div>
                        <div className="text-gray-500 text-xs">
                          {user.email}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> In production, this will send calendar
              invites via Google Calendar, Outlook, or other integrated calendar
              platforms.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
