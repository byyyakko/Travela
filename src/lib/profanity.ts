// Profanity filter utility
// Uses a comprehensive word list, pattern matching, and AI fallback

import { supabaseLovable } from "@/integrations/supabase/client";

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

// Normalize text: strip separators, repeated chars, leetspeak, etc.
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    // Remove separators between letters: f.u.c.k, f-u-c-k, f_u_c_k, f u c k
    .replace(/[\s_\-.*+#~^°!?,;:|\\/'`´\u200B\u200C\u200D]+/g, "")
    // Collapse repeated characters: fuuuuck -> fuck
    .replace(/(.)\1{2,}/g, "$1$1")
    // Common leetspeak replacements
    .replace(/[@4]/g, "a")
    .replace(/[3€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[üùúû]/g, "u")
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o");
};

// Short words that cause false positives when matched as prefixes
// These require word boundaries on BOTH sides
const EXACT_MATCH_WORDS = new Set(["ass", "damn", "crap", "piss", "sex", "nude", "anal", "cock", "meth"]);

// Build regex patterns that match words and common evasion techniques
const buildPatterns = (words: string[]): RegExp[] => {
  return words.map(word => {
    // Create pattern that handles common letter substitutions
    const escaped = word
      .replace(/a/gi, "[a@4àáâãäå]")
      .replace(/e/gi, "[e3èéêë€]")
      .replace(/i/gi, "[i1!|ìíîï]")
      .replace(/o/gi, "[o0òóôõö]")
      .replace(/s/gi, "[s$5]")
      .replace(/t/gi, "[t7]")
      .replace(/l/gi, "[l1|]")
      .replace(/u/gi, "[uùúûü]");
    // Short common words use boundaries on both sides to avoid false positives
    // (e.g., "ass" should not match "passionate")
    if (EXACT_MATCH_WORDS.has(word)) {
      return new RegExp(`\\b${escaped}\\b`, "gi");
    }
    // Longer words use boundary at start but allow derivatives at the end
    return new RegExp(`\\b${escaped}`, "gi");
  });
};

const patterns = buildPatterns(PROFANITY_LIST);

/**
 * Check if text contains profanity using local patterns
 */
export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  
  // Check original text with regex patterns
  const cleaned = text.toLowerCase().replace(/[_\-\.]/g, "");
  if (patterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(cleaned);
  })) return true;

  // Check heavily normalized text for evasion attempts (spaced-out, symbol-laden text)
  // Only trigger on obvious evasion: repeated non-alpha separators between single chars
  // e.g., "f u c k", "f.u.c.k", "f-u-c-k" but NOT normal sentences with spaces
  const hasLetterSpacing = /\b\w[\s.\-_*+#~]{1,3}\w[\s.\-_*+#~]{1,3}\w\b/.test(text) && 
    !/\w{3,}\s+\w{3,}/.test(text); // Exclude normal word spacing
  if (hasLetterSpacing) {
    const normalized = normalizeText(text);
    for (const word of PROFANITY_LIST) {
      const normalizedWord = word.replace(/\s+/g, "");
      if (normalized.includes(normalizedWord)) return true;
    }
  }

  return false;
};

/**
 * AI-powered profanity check using Gemini via edge function.
 * Returns true if the AI detects profanity or inappropriate content.
 * Falls back to false (allow) if the AI check fails.
 */
export const aiCheckProfanity = async (text: string): Promise<boolean> => {
  if (!text || text.trim().length === 0) return false;
  try {
    const { data, error } = await supabaseLovable.functions.invoke("check-profanity", {
      body: { text },
    });
    if (error) {
      console.error("AI profanity check error:", error);
      return false; // fail open – local filter already ran
    }
    return data?.is_profane === true;
  } catch {
    return false;
  }
};

/**
 * Combined check: local filter first, then AI if local passes.
 * Use this for critical fields where evasion is a concern.
 */
export const containsProfanityWithAI = async (text: string): Promise<boolean> => {
  if (containsProfanity(text)) return true;
  return aiCheckProfanity(text);
};

/**
 * Get list of detected profane words
 */
export const detectProfanity = (text: string): string[] => {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[_\-\.]/g, "");
  const found: string[] = [];
  patterns.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      found.push(PROFANITY_LIST[index]);
    }
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
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, (match) => "*".repeat(match.length));
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
