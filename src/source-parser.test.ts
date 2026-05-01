import { describe, it, expect } from 'vitest';
import { parseSource } from './source-parser.js';
import { extractNotionPageId, isNotionUrl } from './notion.js';

describe('source-parser', () => {
  describe('GitLab Custom Domains & Subgroups', () => {
    it('parses custom gitlab domain with deep subgroup paths', () => {
      const result = parseSource('https://git.corp.com/group/subgroup/project/-/tree/main/src');
      expect(result).toEqual({
        type: 'gitlab',
        url: 'https://git.corp.com/group/subgroup/project.git',
        ref: 'main',
        subpath: 'src',
      });
    });

    it('parses gitlab tree with branch but no path', () => {
      const result = parseSource('https://gitlab.example.com/org/repo/-/tree/v1.0');
      expect(result).toEqual({
        type: 'gitlab',
        url: 'https://gitlab.example.com/org/repo.git',
        ref: 'v1.0',
      });
    });

    it('parses custom gitlab domain with port number', () => {
      const result = parseSource('https://git.corp.com:8443/group/repo/-/tree/main');
      expect(result).toMatchObject({
        type: 'gitlab',
        url: 'https://git.corp.com:8443/group/repo.git',
        ref: 'main',
      });
    });

    it('parses http protocol (non-ssl)', () => {
      const result = parseSource('http://git.local/group/repo/-/tree/dev');
      expect(result).toMatchObject({
        type: 'gitlab',
        url: 'http://git.local/group/repo.git',
      });
    });

    it('parses personal project path (~user)', () => {
      const result = parseSource('https://gitlab.com/~user/project/-/tree/main');
      expect(result).toMatchObject({
        type: 'gitlab',
        url: 'https://gitlab.com/~user/project.git',
      });
    });
  });

  describe('Simplified Git Strategy', () => {
    it('treats custom domains with .git as generic git', () => {
      const result = parseSource('https://git.mycompany.com/my-group/my-repo.git');
      expect(result).toEqual({
        type: 'git',
        url: 'https://git.mycompany.com/my-group/my-repo.git',
      });
    });

    it('prevents false positives for generic URLs (falls through to well-known)', () => {
      const result = parseSource('https://google.com/search/result');
      expect(result.type).toBe('well-known');
      expect(result.url).toBe('https://google.com/search/result');
    });

    it('retains official gitlab.com parsing for convenience', () => {
      const result = parseSource('https://gitlab.com/owner/repo');
      expect(result).toEqual({
        type: 'gitlab',
        url: 'https://gitlab.com/owner/repo.git',
      });
    });
  });

  describe('Existing GitHub Support', () => {
    it('parses github shorthand', () => {
      const result = parseSource('vercel-labs/agent-skills');
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/vercel-labs/agent-skills.git',
        subpath: undefined,
      });
    });

    it('parses github full URL', () => {
      const result = parseSource('https://github.com/owner/repo/tree/main/path');
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
        ref: 'main',
        subpath: 'path',
      });
    });

    it('does not treat GitHub blob anchors as refs', () => {
      const result = parseSource('https://github.com/owner/repo/blob/main/README.md#L10');
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
      });
    });

    it('parses github shorthand with #branch', () => {
      const result = parseSource('vercel-labs/agent-skills#feature/install');
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/vercel-labs/agent-skills.git',
        ref: 'feature/install',
        subpath: undefined,
      });
    });

    it('parses github shorthand with trailing slash', () => {
      const result = parseSource('vercel-labs/agent-skills/');
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/vercel-labs/agent-skills.git',
        subpath: undefined,
      });
    });

    it('parses SSH git URL with #branch', () => {
      const result = parseSource('git@github.com:owner/repo.git#feature/install');
      expect(result).toEqual({
        type: 'git',
        url: 'git@github.com:owner/repo.git',
        ref: 'feature/install',
      });
    });
  });

  // ── Notion page URL support ─────────────────────────────────────────────────
  describe('Notion page URLs', () => {
    const TEST_UUID = '353efdeead0580cc9ed9d3ee9b4357b5';

    it('detects notion.so URLs', () => {
      expect(
        isNotionUrl('https://www.notion.so/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5')
      ).toBe(true);
      expect(
        isNotionUrl('https://notion.so/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5')
      ).toBe(true);
    });

    it('detects notion.com URLs', () => {
      expect(
        isNotionUrl('https://www.notion.com/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5')
      ).toBe(true);
      expect(
        isNotionUrl('https://notion.com/workspace/Page-Title-353efdeead0580cc9ed9d3ee9b4357b5')
      ).toBe(true);
    });

    it('does not match non-Notion URLs', () => {
      expect(isNotionUrl('https://github.com/owner/repo')).toBe(false);
      expect(isNotionUrl('https://example.com/page')).toBe(false);
      expect(isNotionUrl('notion.so/no-protocol')).toBe(false);
    });

    it('extracts UUID from notion.so URL with slug', () => {
      const url = `https://www.notion.so/notion/notion-cli-${TEST_UUID}?source=copy_link`;
      expect(extractNotionPageId(url)).toBe(TEST_UUID);
    });

    it('extracts UUID from notion.com URL with slug', () => {
      const url = `https://www.notion.com/workspace/My-Page-${TEST_UUID}`;
      expect(extractNotionPageId(url)).toBe(TEST_UUID);
    });

    it('extracts UUID from bare notion.so URL (no slug)', () => {
      const url = `https://www.notion.so/${TEST_UUID}`;
      expect(extractNotionPageId(url)).toBe(TEST_UUID);
    });

    it('extracts and normalises dashed UUID format', () => {
      // Standard 8-4-4-4-12 dashed UUID
      const dashedId = '353efde e-ad05-80e4-a2b3-ef639a09bffc'.replace(/ /g, '');
      const url = `https://www.notion.so/workspace/${dashedId}`;
      const expected = dashedId.replace(/-/g, '').toLowerCase();
      expect(extractNotionPageId(url)).toBe(expected);
    });

    it('strips query params when extracting UUID', () => {
      const url = `https://notion.so/space/Page-${TEST_UUID}?source=copy_link&foo=bar`;
      expect(extractNotionPageId(url)).toBe(TEST_UUID);
    });

    it('strips fragment when extracting UUID', () => {
      const url = `https://notion.so/space/Page-${TEST_UUID}#some-section`;
      expect(extractNotionPageId(url)).toBe(TEST_UUID);
    });

    it('returns null for Notion URL without a UUID', () => {
      expect(extractNotionPageId('https://www.notion.so/workspace/no-uuid-here')).toBeNull();
      expect(extractNotionPageId('https://www.notion.so/')).toBeNull();
    });

    it('returns null for non-Notion URLs', () => {
      expect(extractNotionPageId('https://github.com/owner/repo')).toBeNull();
    });

    it('parseSource returns notion type for notion.so URL', () => {
      const url = `https://www.notion.so/notion/notion-cli-${TEST_UUID}?source=copy_link`;
      const result = parseSource(url);
      expect(result.type).toBe('notion');
      expect(result.url).toBe(url);
      expect(result.pageId).toBe(TEST_UUID);
    });

    it('parseSource returns notion type for notion.com URL', () => {
      const url = `https://notion.com/workspace/My-Page-${TEST_UUID}`;
      const result = parseSource(url);
      expect(result.type).toBe('notion');
      expect(result.pageId).toBe(TEST_UUID);
    });

    it('parseSource does NOT return well-known for notion.so URLs', () => {
      const url = `https://www.notion.so/notion/Page-${TEST_UUID}`;
      const result = parseSource(url);
      expect(result.type).not.toBe('well-known');
    });
  });
});
