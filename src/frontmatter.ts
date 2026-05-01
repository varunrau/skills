import { parse as parseYaml } from 'yaml';

/**
 * Minimal frontmatter parser. Only supports YAML (the `---` delimiter).
 * Does NOT support `---js` / `---javascript` to avoid eval()-based RCE
 * that exists in gray-matter's built-in JS engine.
 *
 * YAML keys are normalised to lowercase so that sources which capitalise
 * field names (e.g. Notion exports "Name:" / "Description:") are handled
 * identically to the canonical lowercase form.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const parsed = (parseYaml(match[1]!) as Record<string, unknown>) ?? {};
  // Normalise keys to lowercase for consistent field access across all sources.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    data[key.toLowerCase()] = value;
  }
  return { data, content: match[2] ?? '' };
}
