// Turn exported conversation text into individual messages.

const MONTH_HEADER = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4} at \d{1,2}:\d{2}\s*[AP]M/g;

/**
 * Flatten line breaks and split on each "Dear …" greeting, the way every
 * telebirr / CBE message starts. Messages-app date headers are removed.
 */
export function splitMessages(text: string): string[] {
  let flat = text.replace(/\s*\n\s*/g, " ");
  flat = flat.replace(/Text Message • SMS/g, " ");
  flat = flat.replace(MONTH_HEADER, " ");
  flat = flat.split("https:// ").join("https://");
  return flat
    .split(/(?=Dear\s+(?:Customer|[A-Z][A-Za-z]+)[ ,])/)
    .map((c) => c.trim())
    .filter((c) => c.startsWith("Dear"));
}
