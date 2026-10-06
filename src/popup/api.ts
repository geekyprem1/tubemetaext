import type { EditableFieldKey } from '../domain/metadata';
import { isRecord } from '../domain/validation';
import { isErrorCode } from '../shared/errors';
import type {
  ClearSessionDataResponse,
  DraftMutationResponse,
  ExtractionResponse,
} from '../shared/messages';
import { PROTOCOL_VERSION } from '../shared/messages';

function isExtractionResponse(value: unknown): value is ExtractionResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) {
    const state = value.state;
    return (
      isRecord(state) &&
      isRecord(state.snapshot) &&
      typeof state.snapshot.videoId === 'string' &&
      isRecord(state.draft) &&
      typeof state.revision === 'number' &&
      typeof state.epoch === 'number'
    );
  }
  return value.ok === false && isErrorCode(value.code);
}

function isDraftMutationResponse(value: unknown): value is DraftMutationResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) return typeof value.revision === 'number';
  return value.ok === false && isErrorCode(value.code);
}

function isClearSessionDataResponse(value: unknown): value is ClearSessionDataResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) return true;
  return value.ok === false && isErrorCode(value.code);
}

async function sendMessage(message: unknown): Promise<unknown> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return { ok: false, code: 'INVALID_PAYLOAD' };
  }
}

export async function requestOpenVideo(
  tabId: number,
  sessionToken: string,
): Promise<ExtractionResponse> {
  const response = await sendMessage({
    type: 'OPEN_VIDEO',
    protocolVersion: PROTOCOL_VERSION,
    tabId,
    sessionToken,
  });
  return isExtractionResponse(response) ? response : { ok: false, code: 'INVALID_PAYLOAD' };
}

export async function requestRefreshVideo(
  tabId: number,
  videoId: string,
  sessionToken: string,
  epoch: number,
): Promise<ExtractionResponse> {
  const response = await sendMessage({
    type: 'REFRESH_VIDEO',
    protocolVersion: PROTOCOL_VERSION,
    tabId,
    videoId,
    sessionToken,
    epoch,
  });
  return isExtractionResponse(response) ? response : { ok: false, code: 'INVALID_PAYLOAD' };
}

export async function requestPatchDraft(input: {
  tabId: number;
  videoId: string;
  field: EditableFieldKey;
  value: string | string[];
  sessionToken: string;
  epoch: number;
  baseRevision: number;
}): Promise<DraftMutationResponse> {
  const response = await sendMessage({
    type: 'PATCH_DRAFT',
    protocolVersion: PROTOCOL_VERSION,
    ...input,
  });
  return isDraftMutationResponse(response) ? response : { ok: false, code: 'INVALID_PAYLOAD' };
}

export async function requestResetDraft(input: {
  tabId: number;
  videoId: string;
  fields?: EditableFieldKey[];
  sessionToken: string;
  epoch: number;
}): Promise<DraftMutationResponse> {
  const response = await sendMessage({
    type: 'RESET_DRAFT',
    protocolVersion: PROTOCOL_VERSION,
    ...input,
  });
  return isDraftMutationResponse(response) ? response : { ok: false, code: 'INVALID_PAYLOAD' };
}

export async function requestClearSessionData(
  sessionToken: string,
): Promise<ClearSessionDataResponse> {
  const response = await sendMessage({
    type: 'CLEAR_SESSION_DATA',
    protocolVersion: PROTOCOL_VERSION,
    sessionToken,
  });
  return isClearSessionDataResponse(response) ? response : { ok: false, code: 'INVALID_PAYLOAD' };
}
