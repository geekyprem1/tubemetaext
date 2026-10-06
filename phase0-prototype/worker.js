"use strict";

const MAX_TEXT_LENGTH = 100_000;
const MAX_LIST_ITEMS = 1_000;
const MAX_ITEM_LENGTH = 2_000;
const HOST_ALLOWLIST = new Set(["youtube.com", "www.youtube.com"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const queuesByTab = new Map();

function serializeForTab(tabId, operation) {
  const previous = queuesByTab.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  queuesByTab.set(tabId, next);
  return next.finally(() => {
    if (queuesByTab.get(tabId) === next) queuesByTab.delete(tabId);
  });
}

function parseSupportedUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== "https:" || !HOST_ALLOWLIST.has(url.hostname)) return null;

  let pageType;
  let videoId;
  if (url.pathname === "/watch") {
    pageType = "watch";
    videoId = url.searchParams.get("v");
  } else {
    const match = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/);
    if (!match) return null;
    pageType = "shorts";
    videoId = match[1];
  }
  if (!videoId || !VIDEO_ID.test(videoId)) return null;

  const canonicalUrl = pageType === "shorts"
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
  return { videoId, pageType, canonicalUrl };
}

function available(value, source) {
  return { status: "available", value, source };
}

function empty(value, source) {
  return { status: "empty", value, source };
}

function unavailable() {
  return { status: "unavailable", value: null, source: null };
}

function errorField(source, errorCode) {
  return { status: "error", value: null, source, errorCode };
}

function normalizeText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.length > MAX_TEXT_LENGTH) return null;
  return normalized;
}

function normalizeList(value) {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return null;
  const result = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > MAX_ITEM_LENGTH) return null;
    const clean = item.trim();
    if (clean) result.push(clean);
  }
  return result;
}

function normalizeHttpsUrl(value, base = "https://www.youtube.com") {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isAllowedYoutubeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && HOST_ALLOWLIST.has(url.hostname);
  } catch {
    return false;
  }
}

function normalizeContentType(pageType) {
  if (pageType === "shorts") return available("short", "page-route");
  return unavailable();
}

function normalizePlaybackStatus(raw) {
  if (raw?.isUpcoming === true) return available("upcoming", "structured");
  if (raw?.isLiveNow === true) return available("live", "structured");
  if (raw?.isLiveContent === false) return available("recorded", "structured");
  return unavailable();
}

function extractHashtags(titleField, descriptionField) {
  const inputs = [titleField, descriptionField];
  const known = inputs.filter((field) => field.status === "available" || field.status === "empty");
  if (!known.length) return unavailable();
  const isPartial = known.length !== inputs.length;
  const seen = new Set();
  const output = [];
  const tagPattern = /(?:^|\s)#([\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*)/gu;
  for (const field of known) {
    const sourceText = field.value || "";
    for (const match of sourceText.matchAll(tagPattern)) {
      const tag = `#${match[1]}`;
      const key = tag.normalize("NFKC").toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(tag);
      }
    }
  }
  if (isPartial && output.length === 0) return unavailable();
  if (output.length === 0 && isPartial) return unavailable();
  const result = output.length ? available(output, "derived") : empty([], "derived");
  if (isPartial) result.isPartial = true;
  return result;
}

function readCurrentPlayerResponse(expectedVideoId) {
  function toExactInteger(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value);
    if (!/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  function toDateOnly(value) {
    if (typeof value !== "string") return null;
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
    const datePart = match ? match[1] : value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const date = new Date(`${datePart}T00:00:00.000Z`);
    return date.toISOString().slice(0, 10) === datePart ? datePart : null;
  }

  const response = window.ytInitialPlayerResponse;
  const details = response?.videoDetails;
  if (!details || details.videoId !== expectedVideoId) {
    return { ok: false, reason: "PLAYER_ID_MISMATCH" };
  }

  const microformat = response?.microformat?.playerMicroformatRenderer || {};
  const title = typeof details.title === "string" ? details.title : null;
  const description = typeof details.shortDescription === "string" ? details.shortDescription : null;
  const keywordsPresent = Array.isArray(details.keywords);
  const keywords = keywordsPresent ? details.keywords : null;
  const thumbs = Array.isArray(details.thumbnail?.thumbnails) ? details.thumbnail.thumbnails : [];
  const thumbnail = thumbs.length ? thumbs[thumbs.length - 1]?.url : null;
  const channelUrl = microformat.ownerProfileUrl || null;
  const duration = toExactInteger(details.lengthSeconds);
  const views = toExactInteger(details.viewCount);
  const publishDate = toDateOnly(microformat.publishDate) || toDateOnly(microformat.uploadDate);
  const contentStatus = response?.playabilityStatus?.status;
  const liveDetails = microformat.liveBroadcastDetails || {};

  return {
    ok: true,
    videoId: details.videoId,
    title,
    description,
    keywords,
    channelName: typeof details.author === "string" ? details.author : null,
    channelUrl,
    thumbnailUrl: thumbnail,
    durationSeconds: duration,
    views,
    publishDate,
    live: {
      isUpcoming: liveDetails.isUpcoming === true,
      isLiveNow: liveDetails.isLiveNow === true,
      isLiveContent: microformat.isLiveContent === false ? false : undefined
    },
    playabilityStatus: typeof contentStatus === "string" ? contentStatus : null,
    keysPresent: { keywords: keywordsPresent }
  };
}

function verifyCurrentDocument(expectedVideoId) {
  const currentUrl = new URL(location.href);
  const currentId = currentUrl.pathname === "/watch"
    ? currentUrl.searchParams.get("v")
    : currentUrl.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if (currentId !== expectedVideoId) return { ok: false };

  return { ok: true, videoId: currentId };
}

function fieldFromText(value) {
  if (value === "") return empty("", "player-response");
  const normalized = normalizeText(value);
  return normalized === null ? errorField("player-response", "FIELD_TOO_LARGE") : available(normalized, "player-response");
}

function fieldFromList(value, present) {
  if (!present) return unavailable();
  const normalized = normalizeList(value);
  if (normalized === null) return errorField("player-response", "INVALID_OR_TOO_LARGE");
  return normalized.length ? available(normalized, "player-keywords") : empty([], "player-keywords");
}

function fieldFromOptionalText(value, parser = normalizeText) {
  if (value == null || value === "") return unavailable();
  const normalized = parser(value);
  return normalized == null ? unavailable() : available(normalized, "player-response");
}

function normalizeCandidate(player, dom, parsed, tabId, requestId) {
  if (!player?.ok || player.videoId !== parsed.videoId || !dom?.ok || dom.videoId !== parsed.videoId) {
    return { ok: false, code: "VIDEO_CHANGED" };
  }
  if (player.playabilityStatus && player.playabilityStatus !== "OK") {
    return { ok: false, code: "PAGE_NOT_READY" };
  }

  const title = typeof player.title === "string" ? fieldFromText(player.title) : unavailable();
  const description = typeof player.description === "string" ? fieldFromText(player.description) : unavailable();
  const tags = fieldFromList(player.keywords, player.keysPresent?.keywords === true);
  const hashtags = extractHashtags(title, description);
  const channelName = fieldFromOptionalText(player.channelName);
  const channelUrlValue = normalizeHttpsUrl(player.channelUrl);
  const channelUrl = channelUrlValue && isAllowedYoutubeUrl(channelUrlValue) ? available(channelUrlValue, "player-response") : unavailable();
  const thumbnailValue = normalizeHttpsUrl(player.thumbnailUrl);
  const thumbnailHost = thumbnailValue ? new URL(thumbnailValue).hostname : "";
  const thumbnailUrl = thumbnailValue && (thumbnailHost === "ytimg.com" || thumbnailHost.endsWith(".ytimg.com"))
    ? available(thumbnailValue, "player-response")
    : unavailable();
  const publishDate = player.publishDate ? available(player.publishDate, "player-response") : unavailable();
  const playbackStatus = normalizePlaybackStatus(player.live);
  const isMovingLivePage = playbackStatus.status === "available"
    && (playbackStatus.value === "live" || playbackStatus.value === "upcoming");
  const duration = player.durationSeconds == null || isMovingLivePage ? unavailable() : available(player.durationSeconds, "player-response");
  const views = player.views == null || isMovingLivePage ? unavailable() : available(player.views, "player-response");
  const contentType = normalizeContentType(parsed.pageType);

  const fields = [title, description, tags, hashtags];
  if (fields.every((field) => field.status === "unavailable" || field.status === "error")) {
    return { ok: false, code: "NO_CORE_METADATA" };
  }

  return {
    ok: true,
    snapshot: {
      schemaVersion: 1,
      tabId,
      requestId,
      videoId: parsed.videoId,
      pageType: parsed.pageType,
      videoUrl: parsed.canonicalUrl,
      extractedAt: new Date().toISOString(),
      contentType,
      playbackStatus,
      title,
      description,
      tags,
      hashtags,
      channelName,
      channelUrl,
      thumbnailUrl,
      publishDate,
      duration,
      views
    }
  };
}

function isPopupSender(sender) {
  return sender.id === chrome.runtime.id && sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) === true;
}

async function getCurrentParsedTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url) return null;
  return { tab, parsed: parseSupportedUrl(tab.url) };
}

async function extractForTab(tabId) {
  return serializeForTab(tabId, async () => {
    const current = await getCurrentParsedTab(tabId);
    if (!current) return { ok: false, code: "ACCESS_DENIED" };
    const { parsed } = current;
    if (!parsed) return { ok: false, code: "UNSUPPORTED_PAGE" };

    const counterKey = `request:${tabId}`;
    const previous = await chrome.storage.session.get(counterKey);
    const requestId = Number.isSafeInteger(previous[counterKey]) ? previous[counterKey] + 1 : 1;
    await chrome.storage.session.set({ [counterKey]: requestId });

    let playerResults;
    let domResults;
    try {
      [playerResults, domResults] = await Promise.all([
        chrome.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          world: "MAIN",
          func: readCurrentPlayerResponse,
          args: [parsed.videoId]
        }),
        chrome.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          world: "ISOLATED",
          func: verifyCurrentDocument,
          args: [parsed.videoId]
        })
      ]);
    } catch {
      return { ok: false, code: "ACCESS_DENIED" };
    }

    const latest = await getCurrentParsedTab(tabId);
    if (!latest?.parsed || latest.parsed.videoId !== parsed.videoId || latest.tab.url == null) {
      return { ok: false, code: "VIDEO_CHANGED" };
    }
    const mainResult = playerResults?.find((entry) => entry.frameId === 0)?.result;
    const isolatedResult = domResults?.find((entry) => entry.frameId === 0)?.result;
    const normalized = normalizeCandidate(mainResult, isolatedResult, parsed, tabId, requestId);
    if (!normalized.ok) return normalized;

    const snapshotKey = `snapshot:${tabId}:${parsed.videoId}`;
    const record = { schemaVersion: 1, snapshot: normalized.snapshot, savedAt: new Date().toISOString() };
    try {
      await chrome.storage.session.set({ [snapshotKey]: record });
    } catch {
      return { ok: false, code: "STORAGE_FAILED" };
    }

    const unavailableCount = Object.entries(normalized.snapshot)
      .filter(([key, value]) => !["schemaVersion", "tabId", "requestId", "videoId", "pageType", "videoUrl", "extractedAt"].includes(key)
        && value && typeof value === "object" && value.status === "unavailable")
      .length;
    return { ok: true, snapshot: normalized.snapshot, unavailableCount };
  });
}

async function verifyCopyTarget(message) {
  if (!Number.isInteger(message?.tabId) || !VIDEO_ID.test(message?.videoId || "") || !Number.isSafeInteger(message?.requestId)) {
    return { ok: false, code: "INVALID_PAYLOAD" };
  }
  const current = await getCurrentParsedTab(message.tabId);
  if (!current?.parsed || current.parsed.videoId !== message.videoId) return { ok: false, code: "VIDEO_CHANGED" };
  const key = `snapshot:${message.tabId}:${message.videoId}`;
  const stored = await chrome.storage.session.get(key);
  const record = stored[key];
  if (!record?.snapshot || record.snapshot.requestId !== message.requestId) return { ok: false, code: "VIDEO_CHANGED" };
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isPopupSender(sender)) {
    sendResponse({ ok: false, code: "INVALID_SENDER" });
    return false;
  }
  if (message?.type === "EXTRACT_CURRENT_VIDEO" && Number.isInteger(message.tabId)) {
    extractForTab(message.tabId).then(sendResponse, () => sendResponse({ ok: false, code: "EXTRACTION_FAILED" }));
    return true;
  }
  if (message?.type === "VERIFY_COPY_TARGET") {
    verifyCopyTarget(message).then(sendResponse, () => sendResponse({ ok: false, code: "VIDEO_CHANGED" }));
    return true;
  }
  sendResponse({ ok: false, code: "INVALID_PAYLOAD" });
  return false;
});
