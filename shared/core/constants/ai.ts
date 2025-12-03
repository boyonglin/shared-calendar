/**
 * AI Service Constants
 */

/** Maximum input length for AI queries */
export const AI_MAX_INPUT_LENGTH = 1000;

/** Maximum attendee name length in AI responses */
export const AI_MAX_ATTENDEE_LENGTH = 100;

/** Maximum number of attendees in AI requests */
export const AI_MAX_ATTENDEES = 50;

/** Valid tones for AI invitation generation */
export const VALID_TONES = ["professional", "casual", "friendly"] as const;
export type Tone = (typeof VALID_TONES)[number];
