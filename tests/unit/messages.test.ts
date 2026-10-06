import { describe, expect, it } from 'vitest';
import { classifySender, requiredSenderClass, validateRuntimeMessage } from '../../src/shared/messages';
import { MAX_MESSAGE_LENGTH } from '../../src/shared/limits';

const videoId = 'dQw4w9WgXcQ';
const token = 'session-abc_123';

const validMessages: Array<Record<string, unknown>> = [
  { type: 'PING', protocolVersion: 1 },
  { type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 5, sessionToken: token },
  { type: 'REFRESH_VIDEO', protocolVersion: 1, tabId: 5, videoId, sessionToken: token, epoch: 0 },
  {
    type: 'PATCH_DRAFT',
    protocolVersion: 1,
    tabId: 5,
    videoId,
    field: 'tags',
    value: ['abc'],
    sessionToken: token,
    epoch: 1,
    baseRevision: 2,
  },
  { type: 'RESET_DRAFT', protocolVersion: 1, tabId: 5, videoId, sessionToken: token, epoch: 1 },
  { type: 'RESET_DRAFT', protocolVersion: 1, tabId: 5, videoId, fields: ['title', 'tags'], sessionToken: token, epoch: 1 },
  { type: 'CLEAR_SESSION_DATA', protocolVersion: 1, sessionToken: token },
  { type: 'VERIFY_COPY_TARGET', protocolVersion: 1, tabId: 5, videoId, requestId: 9, sessionToken: token, epoch: 2 },
  { type: 'READ_VIDEO', protocolVersion: 1, videoId, requestId: 9 },
  { type: 'VIDEO_INVALIDATED', protocolVersion: 1 },
];

describe('validateRuntimeMessage', () => {
  it('accepts every protocol message type', () => {
    for (const message of validMessages) {
      const result = validateRuntimeMessage(message);
      expect(result.ok, `expected ${String(message.type)} to validate`).toBe(true);
      if (result.ok) {
        expect(result.message.type).toBe(message.type);
      }
    }
  });

  it('rejects unknown versions, types, and malformed payloads with controlled codes', () => {
    const rejected: unknown[] = [
      null,
      'PING',
      42,
      { type: 'PING' },
      { type: 'PING', protocolVersion: 2 },
      { type: 'NOPE', protocolVersion: 1 },
      { type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 0, sessionToken: token },
      { type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 5 },
      { type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 5, sessionToken: 'has space' },
      { type: 'REFRESH_VIDEO', protocolVersion: 1, tabId: 5, videoId: 'short', sessionToken: token, epoch: 0 },
      { type: 'REFRESH_VIDEO', protocolVersion: 1, tabId: 5, videoId, sessionToken: token, epoch: -1 },
      {
        type: 'PATCH_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        field: 'tags',
        value: 'one tag',
        sessionToken: token,
        epoch: 0,
        baseRevision: 0,
      },
      {
        type: 'PATCH_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        field: 'title',
        value: ['a'],
        sessionToken: token,
        epoch: 0,
        baseRevision: 0,
      },
      {
        type: 'PATCH_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        field: 'videoUrl',
        value: 'x',
        sessionToken: token,
        epoch: 0,
        baseRevision: 0,
      },
      { type: 'RESET_DRAFT', protocolVersion: 1, tabId: 5, videoId, fields: ['title', 'bad'], sessionToken: token, epoch: 0 },
      { type: 'READ_VIDEO', protocolVersion: 1, videoId, requestId: -1 },
      { type: 'VERIFY_COPY_TARGET', protocolVersion: 1, tabId: 5, videoId, requestId: 0, sessionToken: token },
    ];

    for (const message of rejected) {
      const result = validateRuntimeMessage(message);
      expect(result.ok, `expected ${JSON.stringify(message)} to be rejected`).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_PAYLOAD');
      }
    }
  });

  it('rejects oversized payloads even when the shape is otherwise valid', () => {
    const oversized = { type: 'PING', protocolVersion: 1, junk: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) };
    expect(validateRuntimeMessage(oversized).ok).toBe(false);
  });
});

describe('sender classification', () => {
  const extensionId = 'example-extension-id';
  const chromeSender = { id: extensionId, url: `chrome-extension://${extensionId}/popup.html` };
  const contentSender = {
    id: extensionId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    tabId: 7,
    frameId: 0,
  };

  it('classifies extension pages, content scripts, and everything else', () => {
    expect(classifySender(chromeSender, extensionId)).toBe('extension-ui');
    expect(classifySender(contentSender, extensionId)).toBe('content');
    expect(classifySender({ ...chromeSender, id: 'other-id' }, extensionId)).toBe('unknown');
    expect(classifySender({ ...contentSender, frameId: 3 }, extensionId)).toBe('unknown');
    expect(classifySender({ ...contentSender, url: `https://evil.test/watch?v=${videoId}` }, extensionId)).toBe('unknown');
    expect(classifySender({ id: extensionId }, extensionId)).toBe('unknown');
    expect(
      classifySender({ id: extensionId, url: 'https://www.youtube.com/', tabId: 7, frameId: 0 }, extensionId),
    ).toBe('content');
  });

  it('keeps privileged draft commands out of content-script reach', () => {
    const contentClass = classifySender(contentSender, extensionId);
    for (const type of ['PATCH_DRAFT', 'RESET_DRAFT', 'CLEAR_SESSION_DATA', 'OPEN_VIDEO', 'VERIFY_COPY_TARGET'] as const) {
      expect(requiredSenderClass(type)).toBe('extension-ui');
      expect(contentClass).not.toBe(requiredSenderClass(type));
    }
    expect(requiredSenderClass('VIDEO_INVALIDATED')).toBe('content');
    expect(classifySender(contentSender, extensionId)).toBe(requiredSenderClass('VIDEO_INVALIDATED'));
  });
});
