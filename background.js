// ReadEasily background service worker.
// Sends selected text to FastAPI only when ReadEasily is enabled.
const API_URL = "http://127.0.0.1:8000/simplify";
const MAX_TEXT_LENGTH = 5000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PROCESS_TEXT") return false;

  (async () => {
    try {
      const settings = await chrome.storage.local.get({ enabled: true });
      if (settings.enabled !== true) {
        sendResponse({ ok: false, error: "ReadEasily is turned off." });
        return;
      }

      if (
        typeof message.text !== "string" ||
        !message.text.trim() ||
        message.text.length > MAX_TEXT_LENGTH
      ) {
        sendResponse({ ok: false, error: "Select between 1 and 5000 characters." });
        return;
      }

      const apiResponse = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text })
      });

      if (!apiResponse.ok) {
        throw new Error(`FastAPI returned HTTP ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("FastAPI returned an empty or missing response.");
      }

      const latestSettings = await chrome.storage.local.get({ enabled: true });
      if (latestSettings.enabled !== true) {
        sendResponse({ ok: false, error: "ReadEasily was turned off." });
        return;
      }

      sendResponse({ ok: true, result: data.response });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || "Could not reach the FastAPI server."
      });
    }
  })();

  // Keep the message channel alive for the async response.
  return true;
});
