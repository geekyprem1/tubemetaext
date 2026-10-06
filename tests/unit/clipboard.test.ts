import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeText = vi.fn(async () => undefined);
vi.stubGlobal('navigator', { clipboard: { writeText } });

let verifyResponse: unknown = { ok: true };
let verifyThrows = false;
const sendMessage = vi.fn(async () => {
  if (verifyThrows) throw new Error('no receiving end');
  return verifyResponse;
});
vi.stubGlobal('chrome', { runtime: { id: 'extension-id', sendMessage } });

const { copyWithVerification } = await import('../../src/popup/clipboard');

const target = {
  tabId: 5,
  videoId: 'dQw4w9WgXcQ',
  requestId: 1,
  sessionToken: 'token-1',
  epoch: 0,
};

beforeEach(() => {
  writeText.mockClear();
  sendMessage.mockClear();
  verifyThrows = false;
  verifyResponse = { ok: true };
});

describe('copyWithVerification', () => {
  it('verifies identity before writing and only then reports success', async () => {
    const outcome = await copyWithVerification(target, 'COPY TEXT');

    expect(outcome).toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'VERIFY_COPY_TARGET', videoId: target.videoId, requestId: 1 }),
    );
    expect(writeText).toHaveBeenCalledWith('COPY TEXT');
    const verifyOrder = sendMessage.mock.invocationCallOrder[0]!;
    const writeOrder = writeText.mock.invocationCallOrder[0]!;
    expect(verifyOrder).toBeLessThan(writeOrder);
  });

  it('cancels the write and reports changed when the target is stale', async () => {
    verifyResponse = { ok: false, code: 'VIDEO_CHANGED' };
    expect(await copyWithVerification(target, 'COPY TEXT')).toEqual({
      ok: false,
      reason: 'changed',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats a malformed verification response as a stale target', async () => {
    verifyResponse = 'garbage';
    expect(await copyWithVerification(target, 'COPY TEXT')).toEqual({
      ok: false,
      reason: 'changed',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('offers manual-copy text when the write fails or the worker is unreachable', async () => {
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    expect(await copyWithVerification(target, 'COPY TEXT')).toEqual({
      ok: false,
      reason: 'failed',
      manualText: 'COPY TEXT',
    });

    verifyThrows = true;
    expect(await copyWithVerification(target, 'COPY TEXT')).toEqual({
      ok: false,
      reason: 'failed',
      manualText: 'COPY TEXT',
    });
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
