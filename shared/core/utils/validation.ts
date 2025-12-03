/**
 * Shared Validation Utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

/**
 * Parse a date parameter, returning undefined if not provided or invalid
 */
export function parseDateParam(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse and validate time range parameters from query params
 * Returns an object with timeMin and timeMax, or an error property if validation fails
 */
export function parseTimeRangeParams(query: {
  timeMin?: unknown;
  timeMax?: unknown;
}): { timeMin?: Date; timeMax?: Date; error?: string } {
  const timeMin = parseDateParam(query.timeMin);
  const timeMax = parseDateParam(query.timeMax);

  if (query.timeMin && !timeMin) {
    return { error: "Invalid timeMin parameter" };
  }
  if (query.timeMax && !timeMax) {
    return { error: "Invalid timeMax parameter" };
  }

  return { timeMin, timeMax };
}

/**
 * Validate friend ID parameter
 */
export function validateFriendId(friendIdStr: string): number | null {
  const friendId = parseInt(friendIdStr, 10);
  return isNaN(friendId) ? null : friendId;
}
