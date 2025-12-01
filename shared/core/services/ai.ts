/**
 * Shared AI Service
 *
 * Handles AI-powered invitation draft generation.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  sanitizeEventDetails,
  sanitizeOutput,
  validateTone,
  buildAIPrompt,
} from "../utils/ai.js";
import type { Tone } from "../constants/index.js";

interface EventDetails {
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
}

/**
 * Get GenAI instance with custom or default API key
 */
function getGenAI(customApiKey?: string): GoogleGenerativeAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export const aiService = {
  /**
   * Generate an invitation draft for a calendar event
   */
  generateInvitationDraft: async (
    eventDetails: EventDetails,
    tone: Tone = "professional",
    customApiKey?: string,
  ): Promise<string> => {
    const genAI = getGenAI(customApiKey);
    if (!genAI) {
      throw new Error(
        "Gemini API key is not configured. Please add your API key in Settings.",
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const sanitized = sanitizeEventDetails(eventDetails);
    const validTone = validateTone(tone);

    const prompt = buildAIPrompt({
      ...sanitized,
      start: eventDetails.start,
      end: eventDetails.end,
      tone: validTone,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return sanitizeOutput(text);
  },
};
