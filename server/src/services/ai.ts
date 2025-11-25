import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

const MAX_INPUT_LENGTH = 1000;
const MAX_TITLE_LENGTH = 200;
const MAX_ATTENDEES = 50;

// Default instance using server-side API key
let defaultGenAI: GoogleGenerativeAI | null = null;

if (env.GEMINI_API_KEY) {
  defaultGenAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

function getGenAI(customApiKey?: string): GoogleGenerativeAI | null {
  if (customApiKey) {
    return new GoogleGenerativeAI(customApiKey);
  }
  return defaultGenAI;
}

function sanitizeInput(input: string, maxLength = MAX_INPUT_LENGTH): string {
  return input
    .replace(/[`${}]/g, "") // Remove characters that could be used for injection
    .trim()
    .slice(0, maxLength);
}

interface EventDetails {
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
}

type Tone = "professional" | "casual" | "friendly";

export const aiService = {
  async generateInvitationDraft(
    eventDetails: EventDetails,
    tone: Tone = "professional",
    customApiKey?: string,
  ): Promise<string> {
    const genAI = getGenAI(customApiKey);
    if (!genAI) {
      throw new Error(
        "Gemini API key is not configured. Please add your API key in Settings.",
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const safeTitle = sanitizeInput(eventDetails.title, MAX_TITLE_LENGTH);
    const safeDescription = eventDetails.description
      ? sanitizeInput(eventDetails.description)
      : "";
    const safeLocation = eventDetails.location
      ? sanitizeInput(eventDetails.location, 200)
      : "";
    const safeAttendees = (eventDetails.attendees ?? [])
      .slice(0, MAX_ATTENDEES)
      .map((a) => sanitizeInput(a, 100));

    const prompt = buildPrompt({
      title: safeTitle,
      description: safeDescription,
      location: safeLocation,
      attendees: safeAttendees,
      start: eventDetails.start,
      end: eventDetails.end,
      tone,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return sanitizeOutput(text);
  },
};

function buildPrompt(params: {
  title: string;
  description: string;
  location: string;
  attendees: string[];
  start: string;
  end: string;
  tone: Tone;
}): string {
  const { title, description, location, attendees, start, end, tone } = params;
  const lines = [
    "You are an AI assistant helping to draft a calendar invitation.",
    "",
    "Event Details:",
    `Title: ${title}`,
    `Time: ${start} to ${end}`,
  ];

  if (description) lines.push(`Description: ${description}`);
  if (location) lines.push(`Location: ${location}`);
  if (attendees.length) lines.push(`Attendees: ${attendees.join(", ")}`);

  lines.push(
    "",
    `Please write a ${tone} invitation message for this event.`,
    "The message should be ready to send via email or chat.",
    "Keep it concise but clear.",
    "",
    "Output only plain text. Do not include any HTML tags, markdown formatting, or code blocks.",
  );

  return lines.join("\n");
}

function sanitizeOutput(text: string): string {
  return text
    .replace(/```(?:markdown|html)?\n?([\s\S]*?)\n?```/gi, "$1") // Remove code blocks
    .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
    .trim();
}
