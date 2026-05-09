/**
 * Platform fee that gets added on top of the host's stated price
 * before the price is shown to bookers.
 */
export const PLATFORM_FEE_RATE = 0.1;

/**
 * Flat platform fee charged to bookers when the host marks the
 * experience as free / no payment required.
 */
export const FREE_FALLBACK_FEE = 1;

const CURRENCY_SYMBOLS = ["$", "€", "£", "¥", "₹", "S$", "A$", "C$", "HK$", "NZ$", "RM", "฿", "₱", "₩", "₫", "kr", "zł"];

/**
 * Parse a free-form price string into { currency, amount }.
 * Returns null if no numeric value found (e.g. "Free", "").
 */
export function parsePrice(price?: string | null): { currency: string; amount: number } | null {
  if (!price) return null;
  const trimmed = String(price).trim();
  if (!trimmed) return null;
  if (/free/i.test(trimmed)) return null;
  // Pull the first number (supports decimals + commas)
  const match = trimmed.match(/(-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(/[,\s]/g, ""));
  if (!isFinite(amount)) return null;
  // Detect currency: prefer multi-char symbols first
  let currency = "$";
  const sorted = [...CURRENCY_SYMBOLS].sort((a, b) => b.length - a.length);
  for (const sym of sorted) {
    if (trimmed.includes(sym)) {
      currency = sym;
      break;
    }
  }
  return { currency, amount };
}

/**
 * Returns the price as shown to bookers (host price + platform fee),
 * formatted as a string. If the input is empty/free, returns "Free".
 */
export function displayPrice(price?: string | null, feeRate: number = PLATFORM_FEE_RATE): string {
  const parsed = parsePrice(price);
  if (!parsed) return "Free";
  const total = parsed.amount * (1 + feeRate);
  const formatted = total.toFixed(2).replace(/\.00$/, "");
  return `${parsed.currency}${formatted}`;
}