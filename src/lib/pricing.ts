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

/**
 * Time window that qualifies an experience as a "last-minute deal"
 * (in hours). Premium viewers see a 50% discount on last-minute
 * experiences that still have open spots.
 */
export const LAST_MINUTE_WINDOW_HOURS = 48;

/** Discount applied for premium last-minute deals (50% off). */
export const PREMIUM_LAST_MINUTE_DISCOUNT = 0.5;

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

const fmt = (n: number) => n.toFixed(2).replace(/\.00$/, "");

export interface BookerPriceInput {
  /** Raw stored price string (host's stated price, no fee applied). */
  price?: string | null;
  /** Host's subscription tier — premium hosts incur no platform fee. */
  hostTier?: string | null;
  /** Viewer's subscription tier — premium viewers get last-minute deals. */
  viewerTier?: string | null;
  /** ISO/Date string for scheduled start. */
  schedule?: string | Date | null;
  /** Spots left (null = unlimited / unknown). */
  spotsLeft?: number | null;
}

export interface BookerPrice {
  basePrice: number;
  fee: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  isFree: boolean;
  hostIsPremium: boolean;
  isLastMinuteDeal: boolean;
  display: string;
  originalDisplay: string | null;
}

export const isPremiumTier = (tier?: string | null) =>
  tier === "tier_1" || tier === "tier_2";

export function isLastMinute(schedule?: string | Date | null): boolean {
  if (!schedule) return false;
  const d = schedule instanceof Date ? schedule : new Date(schedule);
  if (isNaN(d.getTime())) return false;
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return false;
  return diffMs <= LAST_MINUTE_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Compute the price a booker sees, taking into account:
 * - host's tier (premium hosts pay no platform fee)
 * - viewer's tier (premium viewers get 50% off last-minute deals)
 */
export function computeBookerPrice(input: BookerPriceInput): BookerPrice {
  const parsed = parsePrice(input.price);
  const hostIsPremium = isPremiumTier(input.hostTier);
  const viewerIsPremium = isPremiumTier(input.viewerTier);
  const currency = parsed?.currency || "$";
  const basePrice = parsed?.amount ?? 0;
  const isFree = !parsed;

  let fee = 0;
  if (!hostIsPremium) {
    fee = isFree ? FREE_FALLBACK_FEE : basePrice * PLATFORM_FEE_RATE;
  }
  const subtotal = basePrice + fee;

  const hasSpots = input.spotsLeft === null || input.spotsLeft === undefined || input.spotsLeft > 0;
  const isLastMinuteDeal = viewerIsPremium && hasSpots && isLastMinute(input.schedule);
  const discount = isLastMinuteDeal ? subtotal * PREMIUM_LAST_MINUTE_DISCOUNT : 0;
  const total = Math.max(0, subtotal - discount);

  const display = total === 0 ? "Free" : `${currency}${fmt(total)}`;
  const originalDisplay = isLastMinuteDeal && subtotal > 0 ? `${currency}${fmt(subtotal)}` : null;

  return {
    basePrice,
    fee,
    subtotal,
    discount,
    total,
    currency,
    isFree,
    hostIsPremium,
    isLastMinuteDeal,
    display,
    originalDisplay,
  };
}