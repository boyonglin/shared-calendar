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
 * Validate date parameter
 */
export function parseDateParam(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Validate friend ID parameter
 */
export function validateFriendId(friendIdStr: string): number | null {
  const friendId = parseInt(friendIdStr, 10);
  return isNaN(friendId) ? null : friendId;
}
