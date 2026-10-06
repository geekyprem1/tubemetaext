import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildCopyEverything, individualCopyText } from '../domain/copy-format';
import type { TranscriptReadOutcome } from '../content/readers/transcript';
import { hasOverrides, projectDraft } from '../domain/drafts';
import type { EditableFieldKey } from '../domain/metadata';
import { parseSupportedUrl } from '../domain/youtube-url';
import { isRecord } from '../domain/validation';
import type { ErrorCode } from '../shared/errors';
import type { SessionState } from '../shared/messages';
import {
  requestClearSessionData,
  requestOpenVideo,
  requestPatchDraft,
  requestRefreshVideo,
  requestResetDraft,
  requestTranscript,
} from './api';
import { copyWithVerification } from './clipboard';
import { CopyFooter } from './components/CopyFooter';
import { Details } from './components/Details';
import { MetadataField } from './components/MetadataField';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VideoSummary } from './components/VideoSummary';
import { createPopupState, popupReducer } from './state';

const PATCH_DELAY_MS = 300;
const SAVED_VISIBLE_MS = 2000;
type TranscriptData = Extract<TranscriptReadOutcome, { ok: true }>;
type TranscriptError = Extract<TranscriptReadOutcome, { ok: false }>['reason'];

const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNSUPPORTED_PAGE: 'Open a supported YouTube watch or Shorts page.',
  ACCESS_DENIED: 'Chrome could not access this page. Reload the YouTube tab and try again.',
  VIDEO_CHANGED: 'The video changed during extraction. Try again.',
  PAGE_NOT_READY: 'This page has not finished loading the current video yet. Try again.',
  EXTRACTION_TIMEOUT: 'Loading took too long. Try again.',
  NO_CORE_METADATA: 'No reliable metadata was available for this video.',
  READER_FAILED: 'The page structure could not be read. Try refreshing.',
  STORAGE_FAILED: 'Session storage is unavailable, so nothing could be saved.',
};

function isInvalidatedNotice(message: unknown): boolean {
  if (!isRecord(message)) return false;
  return message.type === 'VIDEO_INVALIDATED';
}

export default function App() {
  const [state, dispatch] = useReducer(popupReducer, undefined, () =>
    createPopupState(crypto.randomUUID()),
  );
  const [statusText, setStatusText] = useState<string | null>('Checking the active tab…');
  const [copyFeedback, setCopyFeedback] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const [transcriptState, setTranscriptState] = useState<{
    loading: boolean;
    data: TranscriptData | null;
    error: TranscriptError | null;
  }>({ loading: false, data: null, error: null });
  const [confirmingClear, setConfirmingClear] = useState(false);
  const requestSeq = useRef(0);
  const transcriptSeq = useRef(0);
  const sessionRef = useRef<SessionState | null>(null);
  const manualCopyRef = useRef<HTMLElement | null>(null);
  const sendQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingPatches = useRef(new Map<EditableFieldKey, { value: string | string[]; timer: number }>());
  const { sessionToken } = state;

  useEffect(() => {
    sessionRef.current = state.session;
  }, [state.session]);

  useEffect(() => {
    if (copyFeedback) {
      const timer = window.setTimeout(() => setCopyFeedback(null), copyFeedback.tone === 'success' ? 2800 : 5000);
      return () => window.clearTimeout(timer);
    }
  }, [copyFeedback]);

  useEffect(() => {
    if (manualText !== null) {
      manualCopyRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [manualText]);

  useEffect(() => {
    if (state.draftStatus !== 'saved') return;
    const timer = window.setTimeout(() => dispatch({ type: 'DRAFT_STATUS_IDLE' }), SAVED_VISIBLE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.draftStatus]);

  const runResolve = useCallback(
    async (seq: number) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (requestSeq.current !== seq) return;
      if (!tab?.id) {
        dispatch({ type: 'UNSUPPORTED' });
        setStatusText(null);
        return;
      }
      if (typeof tab.url === 'string' && parseSupportedUrl(tab.url) === null) {
        dispatch({ type: 'UNSUPPORTED' });
        setStatusText(null);
        return;
      }

      dispatch({ type: 'EXTRACT_START', tabId: tab.id });
      setStatusText('Reading the current video…');
      const response = await requestOpenVideo(tab.id, sessionToken);
      if (requestSeq.current !== seq) return;
      if (response.ok) {
        dispatch({ type: 'READY', session: response.state, staleFallback: response.staleFallback === true });
        setStatusText(response.staleFallback === true ? 'Extraction failed; showing previous data.' : null);
        return;
      }
      if (response.code === 'UNSUPPORTED_PAGE') {
        dispatch({ type: 'UNSUPPORTED' });
        setStatusText(null);
        return;
      }
      dispatch({ type: 'FAILED', code: response.code });
      setStatusText(null);
    },
    [sessionToken],
  );

  const resolveAndExtract = useCallback(async () => {
    const seq = ++requestSeq.current;
    transcriptSeq.current += 1;
    setTranscriptState({ loading: false, data: null, error: null });
    dispatch({ type: 'RESOLVE_START' });
    setStatusText('Checking the active tab…');
    setCopyFeedback(null);
    setManualText(null);
    setConfirmingClear(false);
    await runResolve(seq);
  }, [runResolve]);

  const refresh = useCallback(async () => {
    const { session, tabId } = state;
    if (!session || tabId === null) return;
    const seq = ++requestSeq.current;
    transcriptSeq.current += 1;
    setTranscriptState({ loading: false, data: null, error: null });
    dispatch({ type: 'REFRESH_START' });
    setCopyFeedback(null);
    setManualText(null);

    const response = await requestRefreshVideo(
      tabId,
      session.snapshot.videoId,
      sessionToken,
      session.epoch,
    );
    if (requestSeq.current !== seq) return;
    if (response.ok) {
      dispatch({ type: 'READY', session: response.state, staleFallback: response.staleFallback === true });
      setStatusText(response.staleFallback === true ? 'Refresh failed; showing previous data.' : null);
      return;
    }
    if (response.code === 'UNSUPPORTED_PAGE') {
      dispatch({ type: 'UNSUPPORTED' });
      return;
    }
    dispatch({ type: 'FAILED', code: response.code });
    setStatusText(null);
  }, [state, sessionToken]);

  useEffect(() => {
    void runResolve(++requestSeq.current);
  }, [runResolve]);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (isInvalidatedNotice(message)) {
        void resolveAndExtract();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [resolveAndExtract]);

  const performCopy = useCallback(
    async (text: string, label: string) => {
      const session = sessionRef.current;
      if (!session || text.length === 0) return;
      const outcome = await copyWithVerification(
        {
          tabId: session.snapshot.tabId,
          videoId: session.snapshot.videoId,
          requestId: session.snapshot.requestId,
          sessionToken,
          epoch: session.epoch,
        },
        text,
      );
      if (outcome.ok) {
        setCopyFeedback({ text: `${label} copied to clipboard`, tone: 'success' });
        setManualText(null);
        return;
      }
      if (outcome.reason === 'changed') {
        void resolveAndExtract();
        return;
      }
      setCopyFeedback({ text: "Couldn't copy. Use the text below.", tone: 'error' });
      setManualText(outcome.manualText);
    },
    [sessionToken, resolveAndExtract],
  );

  const loadTranscript = useCallback(async (trackIndex?: number, copyAfterLoad = false) => {
    const session = sessionRef.current;
    if (!session) return;
    const seq = ++transcriptSeq.current;
    const { tabId, videoId } = session.snapshot;
    setTranscriptState({ loading: true, data: null, error: null });
    const outcome = await requestTranscript(tabId, videoId, trackIndex ?? null);
    if (transcriptSeq.current !== seq || sessionRef.current?.snapshot.videoId !== videoId) return;
    if (outcome.ok) {
      setTranscriptState({ loading: false, data: outcome, error: null });
      if (copyAfterLoad) {
        void performCopy(outcome.segments.map((segment) => segment.text).join('\n'), 'Transcript');
      }
    } else if (outcome.reason === 'VIDEO_CHANGED') {
      void resolveAndExtract();
    } else {
      setTranscriptState({ loading: false, data: null, error: outcome.reason });
    }
  }, [performCopy, resolveAndExtract]);

  const sendPatch = useCallback(
    async (field: EditableFieldKey, value: string | string[]) => {
      const session = sessionRef.current;
      if (!session) return;
      const response = await requestPatchDraft({
        tabId: session.snapshot.tabId,
        videoId: session.snapshot.videoId,
        field,
        value,
        sessionToken,
        epoch: session.epoch,
        baseRevision: session.revision,
      });
      if (response.ok) {
        dispatch({ type: 'DRAFT_SAVED', revision: response.revision });
        return;
      }
      if (response.code === 'STALE_REVISION' || response.code === 'VIDEO_CHANGED') {
        if (sessionRef.current) void resolveAndExtract();
        return;
      }
      dispatch({ type: 'DRAFT_SAVE_FAILED' });
    },
    [sessionToken, resolveAndExtract],
  );

  const enqueueOperation = useCallback((operation: () => Promise<void>) => {
    sendQueue.current = sendQueue.current.then(operation).catch(() => undefined);
  }, []);

  const schedulePatch = useCallback(
    (field: EditableFieldKey, value: string | string[]) => {
      dispatch({ type: 'OVERRIDE_LOCAL', field, value });
      const existing = pendingPatches.current.get(field);
      if (existing) window.clearTimeout(existing.timer);
      const timer = window.setTimeout(() => {
        pendingPatches.current.delete(field);
        enqueueOperation(() => sendPatch(field, value));
      }, PATCH_DELAY_MS);
      pendingPatches.current.set(field, { value, timer });
    },
    [enqueueOperation, sendPatch],
  );

  const flushField = useCallback(
    (field: EditableFieldKey) => {
      const pending = pendingPatches.current.get(field);
      if (!pending) return;
      window.clearTimeout(pending.timer);
      pendingPatches.current.delete(field);
      enqueueOperation(() => sendPatch(field, pending.value));
    },
    [enqueueOperation, sendPatch],
  );

  const resetFields = useCallback(
    (fields?: EditableFieldKey[]) => {
      for (const [field, pending] of pendingPatches.current) {
        window.clearTimeout(pending.timer);
        enqueueOperation(() => sendPatch(field, pending.value));
      }
      pendingPatches.current.clear();
      dispatch(fields === undefined ? { type: 'OVERRIDE_RESET_LOCAL' } : { type: 'OVERRIDE_RESET_LOCAL', fields });
      enqueueOperation(async () => {
        const session = sessionRef.current;
        if (!session) return;
        const response = await requestResetDraft({
          tabId: session.snapshot.tabId,
          videoId: session.snapshot.videoId,
          ...(fields === undefined ? {} : { fields }),
          sessionToken,
          epoch: session.epoch,
        });
        if (response.ok) {
          dispatch({ type: 'DRAFT_SAVED', revision: response.revision });
          return;
        }
        if (response.code === 'STALE_REVISION' || response.code === 'VIDEO_CHANGED') {
          if (sessionRef.current) void resolveAndExtract();
          return;
        }
        dispatch({ type: 'DRAFT_SAVE_FAILED' });
      });
    },
    [enqueueOperation, sendPatch, sessionToken, resolveAndExtract],
  );

  const clearSessionData = useCallback(async () => {
    for (const pending of pendingPatches.current.values()) {
      window.clearTimeout(pending.timer);
    }
    pendingPatches.current.clear();
    const response = await requestClearSessionData(sessionToken);
    if (response.ok) {
      requestSeq.current += 1;
      transcriptSeq.current += 1;
      setTranscriptState({ loading: false, data: null, error: null });
      dispatch({ type: 'CLEARED' });
      setCopyFeedback(null);
      setManualText(null);
      setConfirmingClear(false);
      return;
    }
    setConfirmingClear(false);
    setCopyFeedback({ text: 'Could not clear session data. Try again.', tone: 'error' });
  }, [sessionToken]);

  const flushAllPatches = useCallback(() => {
    for (const [field, pending] of pendingPatches.current) {
      window.clearTimeout(pending.timer);
      void sendPatch(field, pending.value);
    }
    pendingPatches.current.clear();
  }, [sendPatch]);

  useEffect(() => {
    return () => {
      flushAllPatches();
    };
  }, [flushAllPatches]);

  const projection = useMemo(
    () =>
      state.session
        ? projectDraft(state.session.snapshot, state.session.draft.overrides)
        : null,
    [state.session],
  );

  const exportText = useMemo(
    () =>
      state.session
        ? buildCopyEverything(state.session.snapshot, state.session.draft.overrides)
        : '',
    [state.session],
  );

  const dirtyDraft = state.session ? hasOverrides(state.session.draft.overrides) : false;

  return (
    <main className={state.session ? 'app-shell is-ready' : 'app-shell'}>
      <header className="app-header">
        <div className="brand-group">
          <span className="brand-symbol" aria-hidden="true"><span /></span>
          <div>
            <h1>TubeMeta</h1>
            <p className="subtitle">Extract, edit and copy</p>
          </div>
        </div>
        <div className="header-actions">
          {state.draftStatus !== 'idle' ? (
            <span
              className={state.draftStatus === 'error' ? 'save-state save-error' : 'save-state'}
              role="status"
            >
              {state.draftStatus === 'saving'
                ? 'Saving…'
                : state.draftStatus === 'saved'
                  ? 'Saved'
                  : "Couldn't save edits"}
            </span>
          ) : null}
          <button
            type="button"
            className="icon-button"
            title="Refresh metadata"
            aria-label="Refresh metadata"
            disabled={state.status !== 'ready'}
            onClick={() => void refresh()}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M16.25 9a6.25 6.25 0 1 0 .06 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16.25 4.5V9h-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="content-scroll">

      {state.staleFallback && state.session ? (
        <div className="notice" role="status">
          {statusText ?? 'Showing previous data.'} Refresh to try again.
        </div>
      ) : null}

      {state.status === 'unsupported' ? (
        <section className="state-panel">
          <span className="state-icon" aria-hidden="true">▶</span>
          <h2>Open a YouTube video</h2>
          <p>Visit a video or Short, then open TubeMeta to see its metadata.</p>
          <button type="button" className="state-action" onClick={() => void resolveAndExtract()}>
            Check current tab
          </button>
        </section>
      ) : null}

      {state.status === 'failed' ? (
        <section className="state-panel">
          <span className="state-icon state-icon-error" aria-hidden="true">!</span>
          <h2>Couldn’t read this video</h2>
          <p>{ERROR_MESSAGES[state.errorCode ?? 'INVALID_PAYLOAD'] ?? "We couldn't extract this video's metadata."}</p>
          <button type="button" className="state-action" onClick={() => void resolveAndExtract()}>
            Try again
          </button>
        </section>
      ) : null}

      {state.status === 'cleared' ? (
        <section className="state-panel">
          <span className="state-icon state-icon-success" aria-hidden="true">✓</span>
          <h2>Session data cleared</h2>
          <p>Snapshots and edits were removed from this browser session.</p>
          <button type="button" className="state-action" onClick={() => void resolveAndExtract()}>
            Load current video
          </button>
        </section>
      ) : null}

      {state.status === 'resolving' || state.status === 'extracting' ? (
        <section className="loading-state" aria-busy="true" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <h2>{statusText ?? 'Reading the current video…'}</h2>
          <p>Collecting the metadata available on this page.</p>
          <div className="loading-placeholder" aria-hidden="true" />
          <div className="loading-placeholder loading-placeholder-short" aria-hidden="true" />
        </section>
      ) : null}

      {state.session && projection ? (
        <>
          <VideoSummary
            snapshot={state.session.snapshot}
            stale={state.staleFallback}
            refreshing={state.status === 'refreshing'}
          />
          <TranscriptPanel
            key={state.session.snapshot.videoId}
            loading={transcriptState.loading}
            data={transcriptState.data}
            error={transcriptState.error}
            onLoad={(trackIndex) => void loadTranscript(trackIndex)}
            onCopyDirect={() => void loadTranscript(undefined, true)}
            onCopy={(text) => void performCopy(text, 'Transcript')}
          />
          <div className="metadata-heading">
            <h2>Metadata</h2>
            <span>Edit any field before copying</span>
          </div>
          <div className="field-stack" key={state.session.snapshot.videoId}>
          <MetadataField
            label="Title"
            fieldKey="title"
            kind="text"
            field={projection.title}
            copyText={individualCopyText(projection, 'title')}
            emptyMessage="No title"
            unavailableMessage="Title unavailable"
            onEdit={schedulePatch}
            onFlush={flushField}
            onReset={(field) => resetFields([field])}
            onCopy={(text) => void performCopy(text, 'Title')}
          />
          <MetadataField
            label="Description"
            fieldKey="description"
            kind="text"
            field={projection.description}
            copyText={individualCopyText(projection, 'description')}
            emptyMessage="No description provided"
            unavailableMessage="Description unavailable"
            onEdit={schedulePatch}
            onFlush={flushField}
            onReset={(field) => resetFields([field])}
            onCopy={(text) => void performCopy(text, 'Description')}
          />
          <MetadataField
            label="Tags"
            fieldKey="tags"
            kind="list"
            field={projection.tags}
            copyText={individualCopyText(projection, 'tags')}
            emptyMessage="No tags provided"
            unavailableMessage="Tags unavailable"
            onEdit={schedulePatch}
            onFlush={flushField}
            onReset={(field) => resetFields([field])}
            onCopy={(text) => void performCopy(text, 'Tags')}
          />
          <MetadataField
            label="Hashtags"
            fieldKey="hashtags"
            kind="list"
            field={projection.hashtags}
            copyText={individualCopyText(projection, 'hashtags')}
            emptyMessage="No hashtags found"
            unavailableMessage="Hashtags unavailable"
            onEdit={schedulePatch}
            onFlush={flushField}
            onReset={(field) => resetFields([field])}
            onCopy={(text) => void performCopy(text, 'Hashtags')}
          />
          </div>
          {dirtyDraft ? (
            <button type="button" className="reset-all" onClick={() => resetFields()}>
              Reset all edits
            </button>
          ) : null}
          <Details snapshot={state.session.snapshot} />
          <div className="session-actions">
            {!confirmingClear ? (
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirmingClear(true)}
              >
                Clear session data
              </button>
            ) : (
              <div className="confirm-row" role="group" aria-label="Confirm clearing session data">
                <span className="muted">Clear all session snapshots and drafts?</span>
                <button type="button" className="text-button danger" onClick={() => void clearSessionData()}>
                  Clear
                </button>
                <button type="button" className="text-button" onClick={() => setConfirmingClear(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {manualText !== null ? (
        <section className="manual-copy" ref={manualCopyRef}>
          <h2>Copy manually</h2>
          <p>{"Couldn't write to the clipboard. Select and copy manually:"}</p>
          <textarea
            readOnly
            rows={6}
            value={manualText}
            aria-label="Manual copy text"
            onFocus={(event) => event.currentTarget.select()}
          />
        </section>
      ) : null}
      </div>

      {state.session ? (
        <div className="footer-wrap">
          {copyFeedback ? (
            <div className={`copy-toast copy-toast-${copyFeedback.tone}`} role="status" aria-live="polite">
              <span aria-hidden="true">{copyFeedback.tone === 'success' ? '✓' : '!'}</span>
              {copyFeedback.text}
            </div>
          ) : null}
          <CopyFooter
            enabled={exportText.length > 0}
            copied={copyFeedback?.tone === 'success' && copyFeedback.text.startsWith('All metadata')}
            onCopyAll={() => void performCopy(exportText, 'All metadata')}
          />
        </div>
      ) : null}
    </main>
  );
}
