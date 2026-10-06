import type { PlayerReaderOutcome } from '../content/readers/main-world';
import { readCurrentPlayerResponse } from '../content/readers/main-world';
import type { DomCandidates } from '../content/readers/video-dom';
import { isPositiveInteger, isRecord } from '../domain/validation';
import type { VideoTarget } from '../domain/youtube-url';
import { parseSupportedUrl } from '../domain/youtube-url';
import type { ErrorCode } from '../shared/errors';
import { isErrorCode } from '../shared/errors';
import type {
  ExtractionResponse,
  ReadVideoResponse,
  RuntimeResponse,
  SenderDescriptor,
  VerifyCopyTargetMessage,
} from '../shared/messages';
import {
  PROTOCOL_VERSION,
  classifySender,
  requiredSenderClass,
  validateRuntimeMessage,
} from '../shared/messages';
import type { CurrentRequestMarker } from './storage';
import {
  allocateRequestId,
  applyDraftPatch,
  clearAllSessionData,
  clearCurrentRequest,
  commitSnapshot,
  readCurrentRequest,
  readEpoch,
  readRecord,
  resetDraftOverrides,
  setCurrentRequest,
} from './storage';
import { buildMetadataSnapshot } from './snapshot';

export interface RequestContext {
  sender: SenderDescriptor;
  extensionId: string;
}

function isReadVideoResponse(value: unknown): value is ReadVideoResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) {
    return (
      typeof value.videoId === 'string' &&
      typeof value.documentUrl === 'string' &&
      (value.dom === null || isRecord(value.dom))
    );
  }
  return value.ok === false && isErrorCode(value.code);
}

async function ensureContentScript(
  tabId: number,
  videoId: string,
  requestId: number,
): Promise<{ ok: true; dom: DomCandidates | null } | { ok: false; code: ErrorCode }> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ['content.js'],
    });
  } catch {
    return { ok: false, code: 'ACCESS_DENIED' };
  }

  let response: unknown;
  try {
    response = await chrome.tabs.sendMessage(
      tabId,
      { type: 'READ_VIDEO', protocolVersion: PROTOCOL_VERSION, videoId, requestId },
      { frameId: 0 },
    );
  } catch {
    return { ok: false, code: 'READER_FAILED' };
  }

  if (!isReadVideoResponse(response)) return { ok: false, code: 'READER_FAILED' };
  if (response.ok) {
    return response.videoId === videoId
      ? { ok: true, dom: response.dom }
      : { ok: false, code: 'VIDEO_CHANGED' };
  }
  return { ok: false, code: response.code };
}

async function isStillCurrent(marker: CurrentRequestMarker): Promise<boolean> {
  const current = await readCurrentRequest(marker.tabId);
  if (
    !current ||
    current.sessionToken !== marker.sessionToken ||
    current.requestId !== marker.requestId ||
    current.videoId !== marker.videoId ||
    current.epoch !== marker.epoch
  ) {
    return false;
  }

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(marker.tabId);
  } catch {
    return false;
  }
  if (!tab.url) return false;
  const target = parseSupportedUrl(tab.url);
  return target !== null && target.videoId === marker.videoId;
}

export const extractionRetryPolicy = {
  attempts: 3,
  deadlineMs: 5_000,
  delayMs: 700,
};

type ExtractionAttempt =
  | { ok: true; target: VideoTarget; reader: PlayerReaderOutcome; dom: DomCandidates | null }
  | { ok: false; code: ErrorCode; transient: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readCurrentTarget(
  tabId: number,
): Promise<{ ok: true; target: VideoTarget } | { ok: false; code: ErrorCode }> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { ok: false, code: 'INVALID_PAYLOAD' };
  }
  if (!tab.url) return { ok: false, code: 'ACCESS_DENIED' };
  const target = parseSupportedUrl(tab.url);
  return target ? { ok: true, target } : { ok: false, code: 'UNSUPPORTED_PAGE' };
}

async function attemptExtraction(
  tabId: number,
  marker: CurrentRequestMarker,
): Promise<ExtractionAttempt> {
  const current = await readCurrentTarget(tabId);
  if (!current.ok) return { ...current, transient: false };
  if (current.target.videoId !== marker.videoId) {
    return { ok: false, code: 'VIDEO_CHANGED', transient: true };
  }

  const installed = await ensureContentScript(tabId, marker.videoId, marker.requestId);
  if (!installed.ok) {
    return { ok: false, code: installed.code, transient: installed.code !== 'ACCESS_DENIED' };
  }

  let mainResult: unknown;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: 'MAIN',
      func: readCurrentPlayerResponse,
      args: [marker.videoId],
    });
    mainResult = results.find((entry) => entry.frameId === 0)?.result;
  } catch {
    return { ok: false, code: 'ACCESS_DENIED', transient: false };
  }

  if (!isRecord(mainResult)) return { ok: false, code: 'PAGE_NOT_READY', transient: true };
  if (mainResult.ok !== true) return { ok: false, code: 'VIDEO_CHANGED', transient: true };
  if (!(await isStillCurrent(marker))) return { ok: false, code: 'VIDEO_CHANGED', transient: false };

  return {
    ok: true,
    target: current.target,
    reader: mainResult as unknown as PlayerReaderOutcome,
    dom: installed.dom,
  };
}

async function sameVideoFallback(
  tabId: number,
  videoId: string,
): Promise<ExtractionResponse | null> {
  const current = await readCurrentTarget(tabId);
  if (!current.ok || current.target.videoId !== videoId) return null;
  const record = await readRecord(tabId, videoId);
  if (!record) return null;
  return {
    ok: true,
    state: {
      snapshot: record.snapshot,
      draft: record.draft,
      revision: record.revision,
      epoch: await readEpoch(),
    },
    staleFallback: true,
  };
}

async function commitExtraction(
  snapshot: Parameters<typeof commitSnapshot>[0],
  epoch: number,
): Promise<ExtractionResponse> {
  const committed = await commitSnapshot(snapshot, epoch);
  if (!committed.ok) {
    return {
      ok: false,
      code: committed.code === 'STALE_REVISION' ? 'VIDEO_CHANGED' : committed.code,
    };
  }
  return {
    ok: true,
    state: {
      snapshot: committed.record.snapshot,
      draft: committed.record.draft,
      revision: committed.record.revision,
      epoch,
    },
  };
}

async function runExtraction(
  tabId: number,
  sessionToken: string,
  expectedVideoId: string | null,
): Promise<ExtractionResponse> {
  const initial = await readCurrentTarget(tabId);
  if (!initial.ok) return initial;
  if (expectedVideoId !== null && expectedVideoId !== initial.target.videoId) {
    return { ok: false, code: 'VIDEO_CHANGED' };
  }

  const allocation = await allocateRequestId(tabId);
  if (!allocation.ok) return allocation;

  const marker: CurrentRequestMarker = {
    tabId,
    videoId: initial.target.videoId,
    requestId: allocation.requestId,
    sessionToken,
    epoch: await readEpoch(),
  };
  const markerWrite = await setCurrentRequest(marker);
  if (!markerWrite.ok) return markerWrite;

  const deadline = Date.now() + extractionRetryPolicy.deadlineMs;
  let lastCode: ErrorCode = 'PAGE_NOT_READY';
  for (let attempt = 0; attempt < extractionRetryPolicy.attempts; attempt += 1) {
    const result = await attemptExtraction(tabId, marker);
    if (result.ok) {
      const built = buildMetadataSnapshot({
        tabId,
        requestId: marker.requestId,
        target: result.target,
        reader: result.reader,
        dom: result.dom,
        extractedAt: new Date().toISOString(),
      });
      if (!built.ok) {
        return (await sameVideoFallback(tabId, marker.videoId)) ?? built;
      }
      return commitExtraction(built.snapshot, marker.epoch);
    }
    if (!result.transient) {
      return (await sameVideoFallback(tabId, marker.videoId)) ?? { ok: false, code: result.code };
    }
    lastCode = result.code;
    const isFinalAttempt = attempt === extractionRetryPolicy.attempts - 1;
    if (!isFinalAttempt && Date.now() < deadline) await sleep(extractionRetryPolicy.delayMs);
  }

  const exhaustedCode: ErrorCode = Date.now() >= deadline ? 'EXTRACTION_TIMEOUT' : lastCode;
  return (await sameVideoFallback(tabId, marker.videoId)) ?? { ok: false, code: exhaustedCode };
}

async function verifyCopyTarget(message: VerifyCopyTargetMessage): Promise<RuntimeResponse> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(message.tabId);
  } catch {
    return { ok: false, code: 'VIDEO_CHANGED' };
  }
  if (!tab.url) return { ok: false, code: 'ACCESS_DENIED' };

  const target = parseSupportedUrl(tab.url);
  if (!target || target.videoId !== message.videoId) return { ok: false, code: 'VIDEO_CHANGED' };

  const record = await readRecord(message.tabId, message.videoId);
  if (!record || record.snapshot.requestId !== message.requestId) {
    return { ok: false, code: 'VIDEO_CHANGED' };
  }
  return { ok: true };
}

export async function handleRuntimeMessage(
  message: unknown,
  context: RequestContext,
): Promise<RuntimeResponse> {
  const validation = validateRuntimeMessage(message);
  if (!validation.ok) return { ok: false, code: validation.code };

  const incoming = validation.message;
  if (classifySender(context.sender, context.extensionId) !== requiredSenderClass(incoming.type)) {
    return { ok: false, code: 'INVALID_SENDER' };
  }

  switch (incoming.type) {
    case 'PING':
      return { ok: true, version: chrome.runtime.getManifest().version };

    case 'OPEN_VIDEO':
      return runExtraction(incoming.tabId, incoming.sessionToken, null);

    case 'REFRESH_VIDEO':
      return runExtraction(incoming.tabId, incoming.sessionToken, incoming.videoId);

    case 'PATCH_DRAFT': {
      const result = await applyDraftPatch({
        tabId: incoming.tabId,
        videoId: incoming.videoId,
        field: incoming.field,
        value: incoming.value,
        baseRevision: incoming.baseRevision,
        epoch: incoming.epoch,
      });
      return result.ok ? { ok: true, revision: result.record.revision } : result;
    }

    case 'RESET_DRAFT': {
      const result = await resetDraftOverrides({
        tabId: incoming.tabId,
        videoId: incoming.videoId,
        ...(incoming.fields === undefined ? {} : { fields: incoming.fields }),
        epoch: incoming.epoch,
      });
      return result.ok ? { ok: true, revision: result.record.revision } : result;
    }

    case 'CLEAR_SESSION_DATA': {
      const result = await clearAllSessionData();
      return result.ok ? { ok: true } : result;
    }

    case 'VERIFY_COPY_TARGET':
      return verifyCopyTarget(incoming);

    case 'VIDEO_INVALIDATED': {
      if (isPositiveInteger(context.sender.tabId)) {
        await clearCurrentRequest(context.sender.tabId);
      }
      void chrome.runtime
        .sendMessage({ type: 'VIDEO_INVALIDATED', protocolVersion: PROTOCOL_VERSION })
        .catch(() => undefined);
      return { ok: true };
    }

    default:
      return { ok: false, code: 'INVALID_PAYLOAD' };
  }
}
