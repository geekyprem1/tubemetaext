import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Field } from '../../src/domain/metadata';
import { available, emptyField, errorField, isAvailable, unavailable } from '../../src/domain/metadata';

describe('field states', () => {
  it('keeps zero, empty, unavailable, and error values distinct', () => {
    const zeroViews = available(0, 'structured');
    expect(zeroViews).toEqual({ status: 'available', value: 0, source: 'structured' });
    expect(isAvailable(zeroViews)).toBe(true);

    const emptyDescription = emptyField('', 'structured');
    expect(emptyDescription).toEqual({ status: 'empty', value: '', source: 'structured' });

    const emptyTags = emptyField<string[]>([], 'derived');
    expect(emptyTags.status).toBe('empty');
    expect(emptyTags.value).toEqual([]);

    const missing = unavailable<number>();
    expect(missing).toEqual({ status: 'unavailable', value: null, source: null });

    const failed = errorField<number>('FIELD_TOO_LARGE', 'structured');
    expect(failed).toEqual({
      status: 'error',
      value: null,
      source: 'structured',
      errorCode: 'FIELD_TOO_LARGE',
    });
  });

  it('marks partial availability explicitly and omits the flag otherwise', () => {
    const partial = available(['#AI'], 'derived', true);
    expect(partial.isPartial).toBe(true);

    const full = available(['#AI'], 'derived');
    expect('isPartial' in full).toBe(false);
  });

  it('narrows available fields for consumers', () => {
    const field: Field<string> = available('Example title', 'structured');
    expect(isAvailable(field)).toBe(true);
    if (!isAvailable(field)) throw new Error('expected an available field');
    expect(field.value).toBe('Example title');
  });
});

describe('domain purity', () => {
  it('keeps src/domain free of chrome, window, document, and react dependencies', () => {
    const domainDir = fileURLToPath(new URL('../../src/domain', import.meta.url));
    const files = readdirSync(domainDir).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(path.join(domainDir, file), 'utf8');
      expect(source, file).not.toMatch(/\bchrome\s*\./);
      expect(source, file).not.toMatch(/\bwindow\s*\./);
      expect(source, file).not.toMatch(/\bdocument\s*\./);
      expect(source, file).not.toMatch(/from\s+['"]react(-dom)?(\/[^'"]*)?['"]/);
    }
  });
});
