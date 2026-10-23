/**
 * Models occasionally wrap JSON in a markdown fence or add a short sentence
 * before/after it despite an instruction to return JSON only. Pull out the
 * first object and let the caller turn a parse failure into a provider-specific
 * error.
 */
export function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(candidate);
}
