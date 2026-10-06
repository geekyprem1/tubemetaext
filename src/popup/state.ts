import type { EditableFieldKey } from '../domain/metadata';
import type { ErrorCode } from '../shared/errors';
import type { SessionState } from '../shared/messages';

export type PopupStatus =
  | 'resolving'
  | 'unsupported'
  | 'extracting'
  | 'ready'
  | 'refreshing'
  | 'failed'
  | 'cleared';

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PopupState {
  status: PopupStatus;
  sessionToken: string;
  tabId: number | null;
  session: SessionState | null;
  staleFallback: boolean;
  errorCode: ErrorCode | null;
  draftStatus: DraftStatus;
}

export type PopupAction =
  | { type: 'RESOLVE_START' }
  | { type: 'UNSUPPORTED' }
  | { type: 'EXTRACT_START'; tabId: number }
  | { type: 'REFRESH_START' }
  | { type: 'READY'; session: SessionState; staleFallback: boolean }
  | { type: 'FAILED'; code: ErrorCode }
  | { type: 'OVERRIDE_LOCAL'; field: EditableFieldKey; value: string | string[] }
  | { type: 'OVERRIDE_RESET_LOCAL'; fields?: EditableFieldKey[] }
  | { type: 'DRAFT_SAVED'; revision: number }
  | { type: 'DRAFT_SAVE_FAILED' }
  | { type: 'DRAFT_STATUS_IDLE' }
  | { type: 'CLEARED' };

export function createPopupState(sessionToken: string): PopupState {
  return {
    status: 'resolving',
    sessionToken,
    tabId: null,
    session: null,
    staleFallback: false,
    errorCode: null,
    draftStatus: 'idle',
  };
}

export function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case 'RESOLVE_START':
      return {
        ...state,
        status: 'resolving',
        tabId: null,
        session: null,
        staleFallback: false,
        errorCode: null,
        draftStatus: 'idle',
      };
    case 'UNSUPPORTED':
      return {
        ...state,
        status: 'unsupported',
        tabId: null,
        session: null,
        staleFallback: false,
        errorCode: 'UNSUPPORTED_PAGE',
        draftStatus: 'idle',
      };
    case 'EXTRACT_START':
      return {
        ...state,
        status: 'extracting',
        tabId: action.tabId,
        session: null,
        staleFallback: false,
        errorCode: null,
        draftStatus: 'idle',
      };
    case 'REFRESH_START':
      return {
        ...state,
        status: 'refreshing',
        staleFallback: false,
        errorCode: null,
      };
    case 'READY':
      return {
        ...state,
        status: 'ready',
        session: action.session,
        staleFallback: action.staleFallback,
        errorCode: null,
        draftStatus: 'idle',
      };
    case 'FAILED':
      return {
        ...state,
        status: 'failed',
        session: null,
        staleFallback: false,
        errorCode: action.code,
        draftStatus: 'idle',
      };
    case 'OVERRIDE_LOCAL': {
      if (!state.session) return state;
      const overrides = { ...state.session.draft.overrides };
      if (action.field === 'title' || action.field === 'description') {
        overrides[action.field] = action.value as string;
      } else {
        overrides[action.field] = action.value as string[];
      }
      return {
        ...state,
        session: {
          ...state.session,
          draft: { ...state.session.draft, overrides },
        },
        draftStatus: 'saving',
      };
    }
    case 'OVERRIDE_RESET_LOCAL': {
      if (!state.session) return state;
      const overrides = { ...state.session.draft.overrides };
      if (action.fields === undefined) {
        for (const key of Object.keys(overrides) as EditableFieldKey[]) {
          delete overrides[key];
        }
      } else {
        for (const field of action.fields) {
          delete overrides[field];
        }
      }
      return {
        ...state,
        session: {
          ...state.session,
          draft: { ...state.session.draft, overrides },
        },
        draftStatus: 'saving',
      };
    }
    case 'DRAFT_SAVED':
      return state.session
        ? {
            ...state,
            session: { ...state.session, revision: action.revision },
            draftStatus: 'saved',
          }
        : state;
    case 'DRAFT_SAVE_FAILED':
      return { ...state, draftStatus: 'error' };
    case 'DRAFT_STATUS_IDLE':
      return { ...state, draftStatus: 'idle' };
    case 'CLEARED':
      return {
        ...state,
        status: 'cleared',
        tabId: null,
        session: null,
        staleFallback: false,
        errorCode: null,
        draftStatus: 'idle',
      };
  }
}
