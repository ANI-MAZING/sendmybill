const knownAuthMessages: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "The email or password is incorrect."],
  [/email not confirmed/i, "Please verify your email before signing in."],
  [/already registered|user already registered/i, "An account already exists for this email."],
  [/password.*(weak|short)|at least 6 characters/i, "Use a password with at least 8 characters."],
  [/rate limit|too many requests/i, "Too many attempts. Please wait a moment and try again."],
  [/expired|refresh token/i, "Your session has expired. Please sign in again."],
];

export const getAuthErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : "";
  return knownAuthMessages.find(([pattern]) => pattern.test(rawMessage))?.[1]
    ?? "We could not complete that request. Please try again.";
};
