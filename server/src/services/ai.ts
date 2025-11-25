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

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string): string {
  // Remove or escape characters that could be used to manipulate prompts
  return input
    .replace(/[\r\n]+/g, " ") // Replace newlines with spaces
    .replace(/[`]/g, "'") // Replace backticks with single quotes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .slice(0, 1000); // Limit length to prevent overly long inputs
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
      model: "gemini-1.5-flash",
    });

    // Sanitize all user-provided inputs to prevent prompt injection
    const safeTitle = sanitizeInput(eventDetails.title);
    const safeDescription = eventDetails.description
      ? sanitizeInput(eventDetails.description)
      : "";
    const safeLocation = eventDetails.location
      ? sanitizeInput(eventDetails.location)
      : "";
    const safeAttendees = eventDetails.attendees
      ? eventDetails.attendees.map((a) => sanitizeInput(a))
      : [];

    const prompt = `
      You are an AI assistant helping to draft a calendar invitation.
      
      Event Details:
      Title: ${safeTitle}
      Time: ${eventDetails.start} to ${eventDetails.end}
      ${safeDescription ? `Description: ${safeDescription}` : ""}
      ${safeLocation ? `Location: ${safeLocation}` : ""}
      ${safeAttendees.length ? `Attendees: ${safeAttendees.join(", ")}` : ""}
      
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
