/**
 * Parse the cookie input coming from the frontend.
 * Accepts two formats:
 *   1. JSON array from the "Copy Cookies" browser extension:
 *      [{"name":"li_at","value":"...","domain":".linkedin.com",...}, ...]
 *   2. Plain li_at token string (legacy / manual extraction):
 *      "AQEDATxxxxxxx..."
 *
 * Always returns an array suitable for Apify actor input.
 */
export function parseCookies(input) {
  if (!input) return [];
  const trimmed = String(input).trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through to plain-string handling
    }
  }

  // Plain li_at value — wrap it
  return [{ name: 'li_at', value: trimmed }];
}
