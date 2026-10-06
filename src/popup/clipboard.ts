import { isRecord } from '../domain/validation';
import { isErrorCode } from '../shared/errors';
import type { VerifyCopyTargetResponse } from '../shared/messages';
import { PROTOCOL_VERSION } from '../shared/messages';

export type CopyOutcome =
  | { ok: true }
  | { ok: false; reason: 'changed' }
  | { ok: false; reason: 'failed'; manualText: string };

export interface CopyTarget {
  tabId: number;
  videoId: string;
  requestId: number;
  sessionToken: string;
  epoch: number;
}

function isVerifyResponse(value: unknown): value is VerifyCopyTargetResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) return true;
  return value.ok === false && isErrorCode(value.code);
}

export async function copyWithVerification(target: CopyTarget, text: string): Promise<CopyOutcome> {
  let response: unknown;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'VERIFY_COPY_TARGET',
      protocolVersion: PROTOCOL_VERSION,
      ...target,
    });
  } catch {
    return { ok: false, reason: 'failed', manualText: text };
  }

  if (!isVerifyResponse(response) || response.ok !== true) {
    return { ok: false, reason: 'changed' };
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return { ok: false, reason: 'failed', manualText: text };
  }

  return { ok: true };
}
