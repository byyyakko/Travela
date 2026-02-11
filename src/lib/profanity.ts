// Profanity filter utility
// Uses a comprehensive word list and pattern matching

const PROFANITY_LIST = [
  // English profanity (common)
  "fuck", "shit", "ass", "bitch", "damn", "crap", "dick", "cock", "pussy",
  "bastard", "slut", "whore", "nigger", "nigga", "faggot", "retard",
  "cunt", "twat", "wanker", "piss", "bollocks", "arse", "bugger",
  // Slurs and hate speech
  "chink", "spic", "kike", "wetback", "gook", "beaner",
  // Sexual content
  "porn", "xxx", "nude", "naked", "sex", "anal", "blowjob", "handjob",
  "dildo", "vibrator", "orgasm", "ejaculate", "masturbat",
  // Violence
  "kill yourself", "kys", "suicide", "murder",
  // Drugs
  "cocaine", "heroin", "meth",
];

// Build regex patterns that match words and common evasion techniques
// Uses \b only at the start to catch derivatives (e.g., "fucker", "shitty")
const buildPatterns = (words: string[]): RegExp[] => {
  return words.map(word => {
    // Create pattern that handles common letter substitutions
    const escaped = word
      .replace(/a/gi, "[a@4àáâãäå]")
      .replace(/e/gi, "[e3èéêë]")
      .replace(/i/gi, "[i1!|ìíîï]")
      .replace(/o/gi, "[o0òóôõö]")
      .replace(/s/gi, "[s$5]")
      .replace(/t/gi, "[t7]")
      .replace(/l/gi, "[l1|]")
      .replace(/u/gi, "[uùúûü]");
    // Use word boundary at start but allow derivatives at the end
    return new RegExp(`\\b${escaped}`, "gi");
  });
};

const patterns = buildPatterns(PROFANITY_LIST);

/**
 * Check if text contains profanity
 */
export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[_\-\.]/g, "");
  return patterns.some(pattern => pattern.test(normalized));
};

/**
 * Get list of detected profane words
 */
export const detectProfanity = (text: string): string[] => {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[_\-\.]/g, "");
  const found: string[] = [];
  patterns.forEach((pattern, index) => {
    if (pattern.test(normalized)) {
      found.push(PROFANITY_LIST[index]);
    }
    // Reset lastIndex since we're reusing the regex
    pattern.lastIndex = 0;
  });
  return found;
};

/**
 * Filter profanity from text by replacing with asterisks
 */
export const filterProfanity = (text: string): string => {
  if (!text) return text;
  let filtered = text;
  patterns.forEach((pattern) => {
    filtered = filtered.replace(pattern, (match) => "*".repeat(match.length));
    pattern.lastIndex = 0;
  });
  return filtered;
};

/**
 * Validate text input and return error message if profanity detected
 */
export const validateCleanText = (text: string, fieldName = "text"): string | null => {
  if (containsProfanity(text)) {
    return `Your ${fieldName} contains inappropriate language. Please revise it.`;
  }
  return null;
};
