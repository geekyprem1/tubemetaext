import type { DomCandidates } from '../content/readers/video-dom';
import type { EditableFieldKey, MetadataSnapshot, SessionDraft } from '../domain/metadata';
import { videoIdPatternMatches } from '../domain/youtube-url';
import {
  isEditableFieldKey,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecord,
  isSafeYoutubeHttpsUrl,
  isStringListWithinLimits,
  isTextWithinLimit,
} from '../domain/validation';
import type { ErrorCode } from './errors';
import { MAX_MESSAGE_LENGTH, MAX_SESSION_TOKEN_LENGTH } from './limits';

export const PROTOCOL_VERSION = 1;

interface BaseMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
}

export interface OpenVideoMessage extends BaseMessage {
  type: 'OPEN_VIDEO';
  tabId: number;
  sessionToken: string;
}

export interface RefreshVideoMessage extends BaseMessage {
  type: 'REFRESH_VIDEO';
  tabId: number;
  videoId: string;
  sessionToken: string;
  epoch: number;
}

export interface PatchDraftMessage extends BaseMessage {
  type: 'PATCH_DRAFT';
  tabId: number;
  videoId: string;
  field: EditableFieldKey;
  value: string | string[];
  sessionToken: string;
  epoch: number;
  baseRevision: number;
}

export interface ResetDraftMessage extends BaseMessage {
  type: 'RESET_DRAFT';
  tabId: number;
  videoId: string;
  fields?: EditableFieldKey[];
  sessionToken: string;
  epoch: number;
}

export interface ClearSessionDataMessage extends BaseMessage {
  type: 'CLEAR_SESSION_DATA';
  sessionToken: string;
}

export interface VerifyCopyTargetMessage extends BaseMessage {
  type: 'VERIFY_COPY_TARGET';
  tabId: number;
  videoId: string;
  requestId: number;
  sessionToken: string;
  epoch: number;
}

export interface ReadVideoMessage extends BaseMessage {
  type: 'READ_VIDEO';
  videoId: string;
  requestId: number;
}

export interface VideoInvalidatedMessage extends BaseMessage {
  type: 'VIDEO_INVALIDATED';
}

export type ExtensionUiMessage =
  | PingMessage
  | OpenVideoMessage
  | RefreshVideoMessage
  | PatchDraftMessage
  | ResetDraftMessage
  | ClearSessionDataMessage
  | VerifyCopyTargetMessage;

export type ContentToWorkerMessage = VideoInvalidatedMessage;
export type WorkerToContentMessage = ReadVideoMessage;
export type RuntimeMessage = ExtensionUiMessage | ContentToWorkerMessage | WorkerToContentMessage;

export interface SenderDescriptor {
  id?: string;
  url?: string;
  tabId?: number;
  frameId?: number;
}

export type SenderClass = 'extension-ui' | 'content' | 'unknown';

export function classifySender(sender: SenderDescriptor, extensionId: string): SenderClass {
  if (sender.id !== extensionId) return 'unknown';
  if (typeof sender.url !== 'string') return 'unknown';
  if (sender.url.startsWith(`chrome-extension://${extensionId}/`)) return 'extension-ui';
  if (!isPositiveInteger(sender.tabId) || sender.frameId !== 0) return 'unknown';
  return isSafeYoutubeHttpsUrl(sender.url) ? 'content' : 'unknown';
}

export function requiredSenderClass(type: RuntimeMessage['type']): 'extension-ui' | 'content' {
  return type === 'VIDEO_INVALIDATED' ? 'content' : 'extension-ui';
}

export interface SessionState {
  snapshot: MetadataSnapshot;
  draft: SessionDraft;
  revision: number;
  epoch: number;
}

export type PingResponse = { ok: true; version: string } | { ok: false; code: ErrorCode };

export type ExtractionResponse =
  | { ok: true; state: SessionState; staleFallback?: boolean }
  | { ok: false; code: ErrorCode };

export type DraftMutationResponse = { ok: true; revision: number } | { ok: false; code: ErrorCode };

export type ClearSessionDataResponse = { ok: true } | { ok: false; code: ErrorCode };

export type VerifyCopyTargetResponse = { ok: true } | { ok: false; code: ErrorCode };

export type ReadVideoResponse =
  | { ok: true; videoId: string; documentUrl: string; dom: DomCandidates | null }
  | { ok: false; code: ErrorCode };

export type VideoInvalidatedResponse = { ok: true };

export type RuntimeResponse =
  | PingResponse
  | ExtractionResponse
  | DraftMutationResponse
  | ClearSessionDataResponse
  | VerifyCopyTargetResponse
  | ReadVideoResponse
  | VideoInvalidatedResponse;

export type MessageValidation =
  | { ok: true; message: RuntimeMessage }
  | { ok: false; code: ErrorCode };

function invalid(): MessageValidation {
  return { ok: false, code: 'INVALID_PAYLOAD' };
}

function valid(message: RuntimeMessage): MessageValidation {
  return { ok: true, message };
}

function serializedLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isSessionToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SESSION_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && videoIdPatternMatches(value);
}

function isPatchValue(field: EditableFieldKey, value: unknown): boolean {
  return field === 'title' || field === 'description'
    ? isTextWithinLimit(value)
    : isStringListWithinLimits(value);
}

function isValidResetFields(value: unknown): value is EditableFieldKey[] | undefined {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((field) => isEditableFieldKey(field));
}

export function validateRuntimeMessage(value: unknown): MessageValidation {
  if (serializedLength(value) > MAX_MESSAGE_LENGTH) return invalid();
  if (!isRecord(value)) return invalid();
  if (value.protocolVersion !== PROTOCOL_VERSION) return invalid();

  switch (value.type) {
    case 'PING':
      return valid({ type: 'PING', protocolVersion: PROTOCOL_VERSION });

    case 'OPEN_VIDEO':
      if (!isPositiveInteger(value.tabId) || !isSessionToken(value.sessionToken)) return invalid();
      return valid({
        type: 'OPEN_VIDEO',
        protocolVersion: PROTOCOL_VERSION,
        tabId: value.tabId,
        sessionToken: value.sessionToken,
      });

    case 'REFRESH_VIDEO':
      if (
        !isPositiveInteger(value.tabId) ||
        !isVideoId(value.videoId) ||
        !isSessionToken(value.sessionToken) ||
        !isNonNegativeInteger(value.epoch)
      ) {
        return invalid();
      }
      return valid({
        type: 'REFRESH_VIDEO',
        protocolVersion: PROTOCOL_VERSION,
        tabId: value.tabId,
        videoId: value.videoId,
        sessionToken: value.sessionToken,
        epoch: value.epoch,
      });

    case 'PATCH_DRAFT':
      if (
        !isPositiveInteger(value.tabId) ||
        !isVideoId(value.videoId) ||
        !isEditableFieldKey(value.field) ||
        !isPatchValue(value.field, value.value) ||
        !isSessionToken(value.sessionToken) ||
        !isNonNegativeInteger(value.epoch) ||
        !isNonNegativeInteger(value.baseRevision)
      ) {
        return invalid();
      }
      return valid({
        type: 'PATCH_DRAFT',
        protocolVersion: PROTOCOL_VERSION,
        tabId: value.tabId,
        videoId: value.videoId,
        field: value.field,
        value: value.value as string | string[],
        sessionToken: value.sessionToken,
        epoch: value.epoch,
        baseRevision: value.baseRevision,
      });

    case 'RESET_DRAFT':
      if (
        !isPositiveInteger(value.tabId) ||
        !isVideoId(value.videoId) ||
        !isValidResetFields(value.fields) ||
        !isSessionToken(value.sessionToken) ||
        !isNonNegativeInteger(value.epoch)
      ) {
        return invalid();
      }
      return valid({
        type: 'RESET_DRAFT',
        protocolVersion: PROTOCOL_VERSION,
        tabId: value.tabId,
        videoId: value.videoId,
        ...(value.fields === undefined ? {} : { fields: value.fields }),
        sessionToken: value.sessionToken,
        epoch: value.epoch,
      });

    case 'CLEAR_SESSION_DATA':
      if (!isSessionToken(value.sessionToken)) return invalid();
      return valid({
        type: 'CLEAR_SESSION_DATA',
        protocolVersion: PROTOCOL_VERSION,
        sessionToken: value.sessionToken,
      });

    case 'VERIFY_COPY_TARGET':
      if (
        !isPositiveInteger(value.tabId) ||
        !isVideoId(value.videoId) ||
        !isNonNegativeInteger(value.requestId) ||
        !isSessionToken(value.sessionToken) ||
        !isNonNegativeInteger(value.epoch)
      ) {
        return invalid();
      }
      return valid({
        type: 'VERIFY_COPY_TARGET',
        protocolVersion: PROTOCOL_VERSION,
        tabId: value.tabId,
        videoId: value.videoId,
        requestId: value.requestId,
        sessionToken: value.sessionToken,
        epoch: value.epoch,
      });

    case 'READ_VIDEO':
      if (!isVideoId(value.videoId) || !isNonNegativeInteger(value.requestId)) return invalid();
      return valid({
        type: 'READ_VIDEO',
        protocolVersion: PROTOCOL_VERSION,
        videoId: value.videoId,
        requestId: value.requestId,
      });

    case 'VIDEO_INVALIDATED':
      return valid({ type: 'VIDEO_INVALIDATED', protocolVersion: PROTOCOL_VERSION });

    default:
      return invalid();
  }
}
