import type { Field } from './metadata';
import { available, emptyField, unavailable } from './metadata';

const HASHTAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*)/gu;

export function hashtagDedupeKey(hashtag: string): string {
  return hashtag.normalize('NFKC').toLocaleLowerCase();
}

export function extractHashtags(title: Field<string>, description: Field<string>): Field<string[]> {
  const inputs = [title, description];
  const known: string[] = [];
  for (const field of inputs) {
    if (field.status === 'available' || field.status === 'empty') known.push(field.value);
  }
  if (known.length === 0) return unavailable();
  const isPartial = known.length !== inputs.length;

  const seen = new Set<string>();
  const output: string[] = [];
  for (const text of known) {
    for (const match of text.matchAll(HASHTAG_PATTERN)) {
      const tag = `#${match[1]}`;
      const key = hashtagDedupeKey(tag);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(tag);
      }
    }
  }

  if (output.length === 0) {
    return isPartial ? unavailable() : emptyField([], 'derived');
  }
  return available(output, 'derived', isPartial);
}
