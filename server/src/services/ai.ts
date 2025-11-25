import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

// Default instance using server-side API key
let defaultGenAI: GoogleGenerativeAI | null = null;

if (env.GEMINI_API_KEY) {
  defaultGenAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

// Create a new instance with a custom API key
function getGenAI(customApiKey?: string): GoogleGenerativeAI | null {
  if (customApiKey) {
    return new GoogleGenerativeAI(customApiKey);
  }
  return defaultGenAI;
}

export const aiService = {
  async generateInvitationDraft(
    eventDetails: {
      title: string;
      description?: string;
      start: string;
      end: string;
      attendees?: string[];
      location?: string;
    },
    tone: "professional" | "casual" | "friendly" = "professional",
    customApiKey?: string,
  ) {
    const genAI = getGenAI(customApiKey);

    if (!genAI) {
      throw new Error(
        "Gemini API key is not configured. Please add your API key in Settings.",
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
    });

    const prompt = `
      You are an AI assistant helping to draft a calendar invitation.
      
      Event Details:
      Title: ${eventDetails.title}
      Time: ${eventDetails.start} to ${eventDetails.end}
      ${eventDetails.description ? `Description: ${eventDetails.description}` : ""}
      ${eventDetails.location ? `Location: ${eventDetails.location}` : ""}
      ${eventDetails.attendees?.length ? `Attendees: ${eventDetails.attendees.join(", ")}` : ""}
      
      Please write a ${tone} invitation message for this event.
      The message should be ready to send via email or chat.
      Keep it concise but clear.
      
      Output only the invitation text.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Strip markdown code block formatting if present
    text = text.replace(/^```(?:markdown)?\n([\s\S]*)\n```$/i, "$1").trim();

    return text;
  },
};
