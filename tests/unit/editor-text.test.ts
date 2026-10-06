import { describe, expect, it } from 'vitest';
import { parseEditorText, toEditorText } from '../../src/popup/editor-text';

describe('editor text conversion', () => {
  it('keeps commas inside list tokens and uses one token per line', () => {
    expect(toEditorText(['ai, saas', 'startup'])).toBe('ai, saas\nstartup');
    expect(parseEditorText('ai, saas\n  startup \n\n', 'list')).toEqual(['ai, saas', 'startup']);
  });

  it('preserves text values verbatim including newlines', () => {
    expect(toEditorText('Line one\nLine two')).toBe('Line one\nLine two');
    expect(parseEditorText('Line one\nLine two', 'text')).toBe('Line one\nLine two');
  });

  it('handles null and empty values without inventing content', () => {
    expect(toEditorText(null)).toBe('');
    expect(parseEditorText('', 'list')).toEqual([]);
    expect(parseEditorText('   \n  ', 'list')).toEqual([]);
  });

  it('round-trips list values', () => {
    const tokens = ['#AI', '#हिंदी', 'with space'];
    expect(parseEditorText(toEditorText(tokens), 'list')).toEqual(tokens);
  });
});
