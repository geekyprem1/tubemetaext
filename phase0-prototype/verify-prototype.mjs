import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const videoId = "dQw4w9WgXcQ";
const stored = new Map();
let currentUrl = `https://www.youtube.com/watch?v=${videoId}&list=PLignored&t=90`;
let playerPayload = null;
let messageListener = null;

const chrome = {
  runtime: {
    id: "phase0-test-extension",
    onMessage: { addListener(listener) { messageListener = listener; } }
  },
  tabs: {
    async get(tabId) { return { id: tabId, url: currentUrl }; }
  },
  storage: {
    session: {
      async get(key) { return { [key]: stored.get(key) }; },
      async set(record) { for (const [key, value] of Object.entries(record)) stored.set(key, value); }
    }
  },
  scripting: {
    async executeScript(options) {
      if (options.world === "MAIN") {
        pageContext.window = { ytInitialPlayerResponse: playerPayload };
      } else {
        pageContext.location = { href: currentUrl };
        pageContext.document = { querySelector() { return null; } };
      }
      const injected = vm.runInContext("(" + options.func.toString() + ")", pageContext);
      let result;
      try {
        result = injected(...(options.args || []));
      } catch {
        result = undefined;
      }
      return [{ frameId: 0, result }];
    }
  }
};

const context = vm.createContext({ chrome, URL, Date, Number, Set, Map, Promise, console });
const pageContext = vm.createContext({ URL, console });
const workerSource = await readFile(new URL("./worker.js", import.meta.url), "utf8");
vm.runInContext(workerSource, context, { filename: "worker.js" });
const api = vm.runInContext("({ parseSupportedUrl, normalizeCandidate, extractHashtags })", context);

function makePlayer(id = videoId) {
  return {
    videoDetails: {
      videoId: id,
      title: "Build with #AI and #हिंदी",
      shortDescription: "Full description\nVisit https://example.test/path#fragment\n#Creator",
      keywords: ["AI", "Hindi video", "creator"],
      author: "Example channel",
      lengthSeconds: "164",
      viewCount: "123456",
      thumbnail: { thumbnails: [{ url: "https://i.ytimg.com/vi/example/default.jpg" }] }
    },
    microformat: {
      playerMicroformatRenderer: {
        ownerProfileUrl: "/@example",
        uploadDate: "2025-09-01",
        isLiveContent: false
      }
    },
    playabilityStatus: { status: "OK" }
  };
}

function send(message) {
  return new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      message,
      { id: chrome.runtime.id, url: `chrome-extension://${chrome.runtime.id}/popup.html` },
      resolve
    );
    assert.equal(keepChannelOpen, true);
  });
}

test("accepts only supported secure YouTube routes and canonicalizes parameters", () => {
  const watch = api.parseSupportedUrl(`https://www.youtube.com/watch?list=abc&v=${videoId}&t=9`);
  assert.equal(watch.videoId, videoId);
  assert.equal(watch.pageType, "watch");
  assert.equal(watch.canonicalUrl, `https://www.youtube.com/watch?v=${videoId}`);

  const short = api.parseSupportedUrl(`https://youtube.com/shorts/${videoId}?si=tracking`);
  assert.equal(short.pageType, "shorts");
  assert.equal(short.canonicalUrl, `https://www.youtube.com/shorts/${videoId}`);

  for (const url of [
    `http://www.youtube.com/watch?v=${videoId}`,
    `https://youtube.com.evil.test/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://www.youtube.com/shorts/${videoId}extra`
  ]) assert.equal(api.parseSupportedUrl(url), null, url);
});

test("derives Unicode hashtags and excludes URL fragments", () => {
  const title = { status: "available", value: "Build with #AI and #हिंदी", source: "structured" };
  const description = { status: "available", value: "Go https://example.test/#notatag\n#Creator", source: "structured" };
  const hashtags = api.extractHashtags(title, description);
  assert.deepEqual(Array.from(hashtags.value), ["#AI", "#हिंदी", "#Creator"]);
  assert.equal(hashtags.status, "available");

  const partial = api.extractHashtags(title, { status: "unavailable", value: null, source: null });
  assert.equal(partial.status, "available");
  assert.equal(partial.isPartial, true);
});

test("extracts a video-ID-matched snapshot, preserves exact numerics and session storage", async () => {
  currentUrl = `https://www.youtube.com/watch?v=${videoId}&list=PLignored`;
  playerPayload = makePlayer();
  const result = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 7 });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.videoId, videoId);
  assert.equal(result.snapshot.videoUrl, `https://www.youtube.com/watch?v=${videoId}`);
  assert.equal(result.snapshot.title.value, "Build with #AI and #हिंदी");
  assert.equal(result.snapshot.description.value, "Full description\nVisit https://example.test/path#fragment\n#Creator");
  assert.deepEqual(Array.from(result.snapshot.tags.value), ["AI", "Hindi video", "creator"]);
  assert.equal(result.snapshot.contentType.status, "unavailable", "watch route must not imply long-form");
  assert.equal(result.snapshot.duration.value, 164);
  assert.equal(result.snapshot.views.value, 123456);
  assert.equal(result.snapshot.publishDate.value, "2025-09-01");
  assert.equal(result.snapshot.channelUrl.value, "https://www.youtube.com/@example");
  assert.equal(result.snapshot.playbackStatus.value, "recorded");
  assert.equal(stored.get(`request:7`), result.snapshot.requestId);
  assert.equal(stored.get(`snapshot:7:${videoId}`).snapshot.requestId, result.snapshot.requestId);
});

test("rejects source identity mismatch and never stores that candidate", async () => {
  currentUrl = `https://www.youtube.com/watch?v=${videoId}`;
  playerPayload = makePlayer("aaaaaaaaaaa");
  const result = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 8 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "VIDEO_CHANGED");
  assert.equal(stored.has(`snapshot:8:${videoId}`), false);
});

test("refuses a copy check after the tab changed video or request", async () => {
  currentUrl = `https://www.youtube.com/watch?v=${videoId}`;
  playerPayload = makePlayer();
  const extracted = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 9 });
  assert.equal(extracted.ok, true);

  currentUrl = "https://www.youtube.com/watch?v=abcdefghijk";
  const changedVideo = await send({ type: "VERIFY_COPY_TARGET", tabId: 9, videoId, requestId: extracted.snapshot.requestId });
  assert.equal(changedVideo.code, "VIDEO_CHANGED");

  currentUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const changedRequest = await send({ type: "VERIFY_COPY_TARGET", tabId: 9, videoId, requestId: extracted.snapshot.requestId + 1 });
  assert.equal(changedRequest.code, "VIDEO_CHANGED");
});

test("marks the verified Shorts route as short and leaves live counts/duration unavailable", async () => {
  currentUrl = `https://www.youtube.com/shorts/${videoId}?si=tracking`;
  playerPayload = makePlayer();
  playerPayload.microformat.playerMicroformatRenderer = {
    liveBroadcastDetails: { isLiveNow: true }
  };
  const result = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.contentType.value, "short");
  assert.equal(result.snapshot.playbackStatus.value, "live");
  assert.equal(result.snapshot.duration.status, "unavailable");
  assert.equal(result.snapshot.views.status, "unavailable");
});

test("a watch page never implies long form and missing keywords remain unavailable", async () => {
  currentUrl = `https://www.youtube.com/watch?v=${videoId}`;
  playerPayload = makePlayer();
  delete playerPayload.videoDetails.keywords;
  const result = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 11 });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.contentType.status, "unavailable");
  assert.equal(result.snapshot.tags.status, "unavailable");
});

test("rejects messages from a non-extension sender", async () => {
  let response;
  const keepOpen = messageListener(
    { type: "EXTRACT_CURRENT_VIDEO", tabId: 12 },
    { id: "another-extension", url: "chrome-extension://another-extension/page.html" },
    (value) => { response = value; }
  );
  assert.equal(keepOpen, false);
  assert.equal(response.code, "INVALID_SENDER");
});

test("reports ACCESS_DENIED when the tab URL is hidden without activeTab permission", async () => {
  const savedUrl = currentUrl;
  currentUrl = null;
  const result = await send({ type: "EXTRACT_CURRENT_VIDEO", tabId: 13 });
  currentUrl = savedUrl;
  assert.equal(result.ok, false);
  assert.equal(result.code, "ACCESS_DENIED");
  assert.equal(stored.has("request:13"), false);
  assert.equal(stored.has(`snapshot:13:${videoId}`), false);
});
