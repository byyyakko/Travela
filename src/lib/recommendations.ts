/**
 * Client-side recommendation engine for Circles and Experiences.
 * Computes overlap scores and generates transparent explanation strings.
 */

export interface UserPreferences {
  interests: string[];
  location: string | null;
  destination: string | null;
  languages: string[];
  travel_start_date: string | null;
  travel_end_date: string | null;
  activity_vibe: string | null;       // 'chill' | 'active' | 'both'
  time_availability: string[];        // ['morning','afternoon','evening','night']
}

interface ScoredItem<T> {
  item: T;
  score: number;
  reasons: string[];
}

/** Normalise a tag/interest for comparison */
const norm = (s: string) => s.toLowerCase().trim();

/** Tags that map to a "chill" or "active" vibe */
const CHILL_TAGS = ["food", "arts", "culture", "study", "music", "photo", "volunteering"];
const ACTIVE_TAGS = ["outdoors", "adventure", "sports", "night", "tech"];

function tagOverlap(userInterests: string[], itemTags: string[]): { count: number; matched: string[] } {
  const uSet = new Set(userInterests.map(norm));
  const matched = itemTags.filter(t => uSet.has(norm(t)));
  return { count: matched.length, matched };
}

function cityMatch(userCity: string | null, userDest: string | null, itemCity: string | null): boolean {
  if (!itemCity) return false;
  const ic = norm(itemCity);
  if (userCity && norm(userCity).includes(ic)) return true;
  if (userDest && norm(userDest).includes(ic)) return true;
  if (userCity && ic.includes(norm(userCity))) return true;
  if (userDest && ic.includes(norm(userDest))) return true;
  return false;
}

function vibeMatch(userVibe: string | null, tags: string[]): boolean {
  if (!userVibe || userVibe === "both") return true;
  const normTags = tags.map(norm);
  if (userVibe === "chill") return normTags.some(t => CHILL_TAGS.includes(t));
  if (userVibe === "active") return normTags.some(t => ACTIVE_TAGS.includes(t));
  return true;
}

function scheduleFit(
  userAvail: string[],
  travelStart: string | null,
  travelEnd: string | null,
  scheduleStr: string | null,
): { fits: boolean; dayLabel: string | null; timeLabel: string | null } {
  if (!scheduleStr) return { fits: true, dayLabel: null, timeLabel: null };
  const d = new Date(scheduleStr);
  if (isNaN(d.getTime())) return { fits: true, dayLabel: null, timeLabel: null };

  // Check if within travel dates
  if (travelStart && d < new Date(travelStart)) return { fits: false, dayLabel: null, timeLabel: null };
  if (travelEnd && d > new Date(travelEnd)) return { fits: false, dayLabel: null, timeLabel: null };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayLabel = days[d.getDay()];

  const h = d.getHours();
  let timeSlot: string;
  if (h >= 6 && h < 12) timeSlot = "morning";
  else if (h >= 12 && h < 17) timeSlot = "afternoon";
  else if (h >= 17 && h < 21) timeSlot = "evening";
  else timeSlot = "night";

  const timeLabel = timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1);
  const fits = userAvail.length === 0 || userAvail.includes(timeSlot);
  return { fits, dayLabel, timeLabel };
}

// ---- Public API ----

export function scoreCircles<T extends { tags?: string[] | null; city?: string | null }>(
  prefs: UserPreferences,
  circles: T[],
): ScoredItem<T>[] {
  return circles
    .map(circle => {
      let score = 0;
      const reasons: string[] = [];
      const tags = circle.tags || [];

      const { count, matched } = tagOverlap(prefs.interests, tags);
      if (count > 0) {
        score += count * 3;
        reasons.push(`You chose: ${matched.join(" + ")}`);
      }

      if (cityMatch(prefs.location, prefs.destination, circle.city || null)) {
        score += 2;
        reasons.push(`In ${circle.city}`);
      }

      if (vibeMatch(prefs.activity_vibe, tags)) {
        score += 1;
      }

      return { item: circle, score, reasons };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function scoreExperiences<T extends { tags?: string[] | null; city?: string | null; schedule?: string | null; language?: string | null }>(
  prefs: UserPreferences,
  experiences: T[],
): ScoredItem<T>[] {
  return experiences
    .map(exp => {
      let score = 0;
      const reasons: string[] = [];
      const tags = exp.tags || [];

      const { count, matched } = tagOverlap(prefs.interests, tags);
      if (count > 0) {
        score += count * 3;
        reasons.push(`You chose: ${matched.join(" + ")}`);
      }

      if (cityMatch(prefs.location, prefs.destination, exp.city || null)) {
        score += 2;
        reasons.push(`In ${exp.city}`);
      }

      const { fits, dayLabel, timeLabel } = scheduleFit(
        prefs.time_availability,
        prefs.travel_start_date,
        prefs.travel_end_date,
        exp.schedule || null,
      );
      if (fits && dayLabel) {
        score += 2;
        reasons.push(`You're free on ${dayLabel}${timeLabel ? ` ${timeLabel}` : ""}`);
      }
      if (!fits) {
        score -= 2; // penalise schedule mismatch
      }

      if (exp.language && prefs.languages.length > 0) {
        if (prefs.languages.some(l => norm(l) === norm(exp.language!))) {
          score += 1;
          reasons.push(`In ${exp.language}`);
        }
      }

      if (vibeMatch(prefs.activity_vibe, tags)) {
        score += 1;
      }

      return { item: exp, score, reasons };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
