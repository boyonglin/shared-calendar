/**
 * Shared AI Utilities
 */
import {
  AI_MAX_INPUT_LENGTH,
  AI_MAX_ATTENDEE_LENGTH,
  AI_MAX_ATTENDEES,
  VALID_TONES,
  type Tone,
} from "../constants/index.js";

// Patterns that could be used for prompt injection attacks
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?prior\s+instructions?/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?:/gi,
  /system\s*:/gi,
  /\[system\]/gi,
  /\[assistant\]/gi,
  /\[user\]/gi,
];

/**
 * Sanitize user input for AI prompts
 */
export function sanitizeInput(
  input: string,
  maxLength = AI_MAX_INPUT_LENGTH,
): string {
  let sanitized = input.replace(/[`${}]/g, "").trim();

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized.slice(0, maxLength);
}

/**
 * Sanitize AI output
 */
export function sanitizeOutput(text: string): string {
  return text
    .replace(/```(?:markdown|html)?\n?([\s\S]*?)\n?```/gi, "$1")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

/**
 * Validate and normalize tone
 */
export function validateTone(tone: unknown): Tone {
  if (typeof tone === "string" && VALID_TONES.includes(tone as Tone)) {
    return tone as Tone;
  }
  return "professional";
}

/**
 * Build AI prompt for invitation generation
 */
export function buildAIPrompt(params: {
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

/**
 * Sanitize event details for AI processing
 */
export function sanitizeEventDetails(eventDetails: {
  title: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): {
  title: string;
  description: string;
  location: string;
  attendees: string[];
} {
  return {
    title: sanitizeInput(eventDetails.title, AI_MAX_INPUT_LENGTH),
    description: eventDetails.description
      ? sanitizeInput(eventDetails.description)
      : "",
    location: eventDetails.location
      ? sanitizeInput(eventDetails.location, AI_MAX_INPUT_LENGTH)
      : "",
    attendees: (eventDetails.attendees ?? [])
      .slice(0, AI_MAX_ATTENDEES)
      .map((a) => sanitizeInput(a, AI_MAX_ATTENDEE_LENGTH)),
  };
}
