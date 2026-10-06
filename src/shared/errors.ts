export const ERROR_CODES = [
  'UNSUPPORTED_PAGE',
  'ACCESS_DENIED',
  'VIDEO_CHANGED',
  'PAGE_NOT_READY',
  'EXTRACTION_TIMEOUT',
  'NO_CORE_METADATA',
  'READER_FAILED',
  'INVALID_PAYLOAD',
  'INVALID_SENDER',
  'STALE_REVISION',
  'STORAGE_FAILED',
  'CLIPBOARD_FAILED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
