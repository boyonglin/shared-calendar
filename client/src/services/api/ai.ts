import { apiClient } from "./client";
import { getGeminiApiKey } from "../../components/SettingsModal";

interface DraftInvitationParams {
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  tone?: "professional" | "casual" | "friendly";
}

interface DraftInvitationResponse {
  draft: string;
}

export async function generateInvitationDraft(
  params: DraftInvitationParams,
): Promise<DraftInvitationResponse> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error("Gemini API key not configured");
  }

  return apiClient.post<DraftInvitationResponse>("/api/ai/draft-invitation", {
    ...params,
    geminiApiKey,
  });
}
