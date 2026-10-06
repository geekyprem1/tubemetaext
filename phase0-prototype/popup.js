"use strict";

const statusNode = document.querySelector("#status");
const fieldsNode = document.querySelector("#fields");
const summaryNode = document.querySelector("#summary");
const copyAllButton = document.querySelector("#copy-all");
let currentSnapshot = null;
let busy = false;

const EXPORT_ORDER = [
  ["title", "TITLE", "text"],
  ["description", "DESCRIPTION", "text"],
  ["tags", "PLAYER KEYWORDS (CANDIDATE)", "list"],
  ["hashtags", "HASHTAGS", "list"],
  ["videoUrl", "VIDEO URL", "text"],
  ["videoId", "VIDEO ID", "text"],
  ["channelName", "CHANNEL NAME", "text"],
  ["channelUrl", "CHANNEL URL", "text"],
  ["thumbnailUrl", "THUMBNAIL URL", "text"],
  ["publishDate", "PUBLISH DATE", "text"],
  ["duration", "DURATION", "text"],
  ["views", "VIEWS", "text"],
  ["contentType", "CONTENT TYPE", "text"],
  ["playbackStatus", "PLAYBACK STATUS", "text"],
  ["extractedAt", "EXTRACTED AT", "text"]
];

function setStatus(message) {
  statusNode.textContent = message;
}

function formatValue(field, kind) {
  if (!field || field.status !== "available" || field.value == null) return "";
  if (kind === "list") return Array.isArray(field.value) ? field.value.map((item) => String(item).trim()).filter(Boolean).join(", ") : "";
  return String(field.value).trim();
}

function toExportRows(snapshot) {
  return EXPORT_ORDER.flatMap(([key, label, kind]) => {
    const field = snapshot[key];
    const value = formatValue(field, kind);
    if (!value) return [];
    const heading = key === "hashtags" && field.isPartial ? "HASHTAGS (PARTIAL)" : label;
    return [[heading, value]];
  });
}

function createFieldCard([heading, value]) {
  const section = document.createElement("section");
  section.className = "field";

  const top = document.createElement("div");
  top.className = "field-heading";
  const label = document.createElement("strong");
  label.textContent = heading;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copy";
  button.addEventListener("click", () => copyText(value, `${heading} copied`));
  top.append(label, button);

  const content = document.createElement("p");
  content.className = "field-value";
  content.textContent = value;
  section.append(top, content);
  return section;
}

function render(snapshot) {
  currentSnapshot = snapshot;
  const rows = toExportRows(snapshot);
  fieldsNode.replaceChildren(...rows.map(createFieldCard));
  fieldsNode.hidden = false;
  summaryNode.hidden = false;
  const title = formatValue(snapshot.title, "text");
  document.querySelector("#title-preview").textContent = title || "Video metadata";
  document.querySelector("#video-kind").textContent = `${snapshot.pageType} page · ${formatValue(snapshot.contentType, "text") || "type unknown"}`;
  document.querySelector("#source-id").textContent = `Video ID: ${snapshot.videoId}`;
  copyAllButton.disabled = rows.length === 0 || busy;
}

async function copyText(value, successMessage) {
  if (!value || !currentSnapshot || busy) return;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "VERIFY_COPY_TARGET",
      tabId: currentSnapshot.tabId,
      videoId: currentSnapshot.videoId,
      requestId: currentSnapshot.requestId
    });
    if (!result?.ok) {
      currentSnapshot = null;
      copyAllButton.disabled = true;
      setStatus("Video changed. Refresh before copying.");
      return;
    }
    await navigator.clipboard.writeText(value);
    setStatus(successMessage);
  } catch {
    setStatus("Couldn't copy. Try again or select the metadata text manually.");
  }
}

async function extract() {
  if (busy) return;
  busy = true;
  currentSnapshot = null;
  copyAllButton.disabled = true;
  fieldsNode.replaceChildren();
  fieldsNode.hidden = true;
  summaryNode.hidden = true;
  setStatus("Checking the active tab…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("UNSUPPORTED_PAGE");
    setStatus("Reading the current video…");
    const result = await chrome.runtime.sendMessage({ type: "EXTRACT_CURRENT_VIDEO", tabId: tab.id });
    if (!result?.ok) throw new Error(result?.code || "EXTRACTION_FAILED");
    render(result.snapshot);
    const unavailable = result.unavailableCount;
    setStatus(unavailable ? `Available metadata loaded; ${unavailable} fields unavailable.` : "Metadata loaded.");
  } catch (error) {
    const messages = {
      UNSUPPORTED_PAGE: "Open a supported YouTube watch or Shorts page.",
      ACCESS_DENIED: "Chrome could not access this page. Reload YouTube and try again.",
      VIDEO_CHANGED: "The video changed during extraction. Refresh and try again.",
      PAGE_NOT_READY: "This page has not finished loading the current video yet. Try again.",
      NO_CORE_METADATA: "Current video found, but no reliable core metadata was available."
    };
    const code = error instanceof Error ? error.message : "EXTRACTION_FAILED";
    setStatus(messages[code] || "We couldn't extract this video's metadata. Try Refresh.");
  } finally {
    busy = false;
    if (currentSnapshot) copyAllButton.disabled = toExportRows(currentSnapshot).length === 0;
  }
}

copyAllButton.addEventListener("click", async () => {
  if (!currentSnapshot || busy) return;
  const value = toExportRows(currentSnapshot).map(([heading, text]) => `${heading}:\n${text}`).join("\n\n");
  await copyText(value, "Available metadata copied");
});
document.querySelector("#refresh").addEventListener("click", extract);
void extract();
