import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Regex patterns for extracting Notion page UUIDs.
 *
 * Notion page URLs look like:
 *   https://www.notion.so/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5
 *   https://notion.com/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5?source=copy_link
 *   https://www.notion.so/353efdeead0580cc9ed9d3ee9b4357b5  (UUID only, no slug)
 *
 * The UUID is always 32 contiguous hex characters, optionally preceded by a
 * hyphen-separated slug, at the end of the URL path (before any query/fragment).
 * Notion also occasionally surfaces the dashed UUID format (8-4-4-4-12).
 */
const UUID_HEX_RE = /([0-9a-f]{32})(?:[?#]|$)/i;
const UUID_DASHED_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#]|$)/i;

/**
 * Check whether a URL is a Notion page URL (notion.so or notion.com,
 * with any subdomain or none).
 */
export function isNotionUrl(input: string): boolean {
  try {
    const { hostname } = new URL(input);
    return hostname === 'notion.so' || hostname === 'notion.com';
  } catch {
    return false;
  }
}

/**
 * Extract the Notion page ID from a Notion URL.
 * Returns the normalised 32-char hex string (no dashes), or null if no UUID
 * can be found.
 *
 * Works for both notion.so and notion.com URLs.
 */
export function extractNotionPageId(input: string): string | null {
  if (!isNotionUrl(input)) {
    return null;
  }

  // Strip query params / fragments first so the anchored pattern works.
  const withoutParams = input.replace(/[?#].*$/, '');

  // Prefer the 32-char no-dashes form (most common in Notion share links).
  const hexMatch = withoutParams.match(UUID_HEX_RE);
  if (hexMatch) {
    return hexMatch[1]!.toLowerCase();
  }

  // Fall back to dashed UUID format (8-4-4-4-12).
  const dashedMatch = input.match(UUID_DASHED_RE);
  if (dashedMatch) {
    return dashedMatch[1]!.replace(/-/g, '').toLowerCase();
  }

  return null;
}

/**
 * Check whether the `ntn` CLI is available in the current PATH.
 */
export async function isNtnInstalled(): Promise<boolean> {
  try {
    await execFileAsync('ntn', ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch the Markdown content of a Notion page using the `ntn` CLI.
 * Throws if the command fails (e.g., page not found or no auth).
 */
export async function fetchNotionPageMarkdown(pageId: string): Promise<string> {
  // pageId is validated to be 32 hex chars before this is called, so no
  // shell-injection risk even though we pass it as an execFile argument.
  const { stdout } = await execFileAsync('ntn', ['pages', 'get', pageId], {
    timeout: 30_000,
  });
  return stdout;
}
