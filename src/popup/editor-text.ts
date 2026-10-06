export function toEditorText(value: string | string[] | null): string {
  if (Array.isArray(value)) return value.join('\n');
  return typeof value === 'string' ? value : '';
}

export function parseEditorText(text: string, kind: 'text' | 'list'): string | string[] {
  if (kind === 'text') return text;
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
