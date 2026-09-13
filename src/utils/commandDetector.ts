/**
 * Command and Wake Word detection utilities for MYRAA
 */

const STOP_PATTERNS = [
  /\bstop\b/i,
  /\bstop\s+listening\b/i,
  /\bstop\s+talking\b/i,
  /\bgo\s+to\s+sleep\b/i,
  /\bsleep\b/i,
  /\bbe\s+quiet\b/i,
  /\bstand\s*by\b/i,
  /\bstandby\b/i,
  /\bshut\s*up\b/i,
  /\bhush\b/i,
  /\bquiet\b/i,
  /\bpause\b/i,
  /\bhalt\b/i,
];

const WAKE_PATTERNS = [
  /^(myraa|myra|mira|mayra|maira|meera|myrah|mera|miraa)(\s+wake\s+up)?$/i,
  /\b(myraa|myra|mira|mayra|maira|meera|myrah|mera|miraa)(\s+wake\s+up)?\b/i,
];

// Explicit negative list of common false-positive triggers that must never wake MYRAA
const FALSE_POSITIVE_PATTERNS = [
  /\bvanilla\b/i,
  /\balexa(\s+wake\s+up)?\b/i,
  /\b(hey\s+)?google\b/i,
  /\bsiri\b/i,
  /\bcortana\b/i,
  /\bbanana\b/i,
  /\bmanager\b/i,
];

/**
 * Checks if the given text matches a stop command.
 */
export function isStopCommand(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  if (!clean) return false;

  // Direct word checks
  if (
    clean === 'stop' ||
    clean === 'sleep' ||
    clean === 'be quiet' ||
    clean === 'standby' ||
    clean === 'stand by' ||
    clean === 'go to sleep' ||
    clean === 'stop talking' ||
    clean === 'stop listening' ||
    clean === 'shut up' ||
    clean === 'quiet' ||
    clean === 'hush' ||
    clean === 'halt' ||
    clean === 'pause'
  ) {
    return true;
  }

  // Regex pattern check
  return STOP_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Checks if the given transcript matches the single wake word ("Myraa").
 * Non-wake words like "hello", "hey", or "hi" alone will return false.
 */
export function isWakeWord(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  if (!clean) return false;

  // Explicit non-wake words & conversational words
  if (clean === 'hello' || clean === 'hey' || clean === 'hi' || clean === 'okay' || clean === 'ok') {
    return false;
  }

  // Explicit false positive rejection
  if (FALSE_POSITIVE_PATTERNS.some((pattern) => pattern.test(clean))) {
    return false;
  }

  return WAKE_PATTERNS.some((pattern) => pattern.test(clean));
}
