/**
 * Shared date handling for the chronology game and the set builder.
 *
 * Dates in set files are plain strings so teachers can type them by hand:
 *   "1973"            -> year only
 *   "1973-09"          -> year and month
 *   "1973-09-11"       -> year, month, and day
 *   "-0323"            -> BCE year (a leading "-" means "BCE", e.g. -0323 = 323 BCE)
 *
 * This file turns those strings into a single sortable number (so the game
 * can tell what order things really happened in) and into a human-readable
 * label (so the game can reveal "11 September 1973" once a card is placed).
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DATE_PATTERN = /^(-?\d{1,6})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;

/**
 * Parse a date string into { year, month, day, precision }.
 * month/day are 1-based when present, otherwise default to 1 (so two dates
 * that differ only in precision, e.g. "1968" and "1968-01-01", are still
 * treated as sorting identically).
 * Returns null if the string can't be understood.
 */
function parseEventDate(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  if (Number.isNaN(year)) return null;

  let month = 1;
  let day = 1;
  let precision = 'year';

  if (match[2] !== undefined) {
    month = parseInt(match[2], 10);
    if (month < 1 || month > 12) return null;
    precision = 'month';
  }
  if (match[3] !== undefined) {
    day = parseInt(match[3], 10);
    if (day < 1 || day > 31) return null;
    precision = 'day';
  }

  return { year, month, day, precision, raw: trimmed };
}

/** A single number that sorts correctly across years, months, and days (including BCE). */
function dateSortValue(parsed) {
  return parsed.year * 372 + (parsed.month - 1) * 31 + (parsed.day - 1);
}

/** Two parsed dates are "tied" if they sort identically (same precision-adjusted value). */
function datesAreTied(a, b) {
  return dateSortValue(a) === dateSortValue(b);
}

/** Build a human-readable label like "11 September 1973", "September 1973", "1973", or "323 BCE". */
function formatDisplayDate(parsed) {
  const isBce = parsed.year <= 0;
  const yearLabel = isBce ? `${Math.abs(parsed.year)} BCE` : `${parsed.year}`;

  if (parsed.precision === 'day') {
    return `${parsed.day} ${MONTH_NAMES[parsed.month - 1]} ${yearLabel}`;
  }
  if (parsed.precision === 'month') {
    return `${MONTH_NAMES[parsed.month - 1]} ${yearLabel}`;
  }
  return yearLabel;
}

/** Convenience: parse + format in one step, with a fallback for bad input. */
function displayDateFromString(raw) {
  const parsed = parseEventDate(raw);
  if (!parsed) return raw;
  return formatDisplayDate(parsed);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseEventDate,
    dateSortValue,
    datesAreTied,
    formatDisplayDate,
    displayDateFromString,
    MONTH_NAMES
  };
}
