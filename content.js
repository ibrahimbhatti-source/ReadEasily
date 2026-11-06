// ReadEasily content script: text selection and scrollable simplified-text panel.
// Always obeys the global on/off toggle, including while a request is running.
(() => {
  if (globalThis.__readEasilyInitialized) return;
  globalThis.__readEasilyInitialized = true;

  const MAX_TEXT_LENGTH = 5000;
  const SCREEN_MARGIN = 8;
  let enabled = false;  // Stay off until Chrome storage confirms the saved setting.
  let selectedText = "";
  let requestVersion = 0;
  let storageVersion = 0;

  // Remove any UI left by a previous extension context after a reload.
  for (const id of ["select-helper-action", "select-helper-panel"]) {
    document.getElementById(id)?.remove();
  }

  const actionButton = document.createElement("button");
  actionButton.id = "select-helper-action";
  actionButton.type = "button";
  actionButton.textContent = "Simplify";
  actionButton.hidden = true;
  document.body.appendChild(actionButton);

  const resultPanel = document.createElement("div");
  resultPanel.id = "select-helper-panel";
  resultPanel.hidden = true;
  resultPanel.setAttribute("role", "status");

  const closeButton = document.createElement("button");
  closeButton.id = "select-helper-close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close simplified text");

  const resultText = document.createElement("div");
  resultText.id = "select-helper-result";
  resultPanel.append(closeButton, resultText);
  document.body.appendChild(resultPanel);

  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) {
      requestVersion += 1; // Ignore results/errors from requests started earlier.
      selectedText = "";
      actionButton.hidden = true;
      resultPanel.hidden = true;
    }
  }

  // Keep in sync when the popup is switched on or off in any Chrome window.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) return;
    storageVersion += 1;
    setEnabled(changes.enabled.newValue);
  });

  // Ignore a slow initial read if a newer change event has already arrived.
  const initialVersion = storageVersion;
  chrome.storage.local.get({ enabled: true })
    .then(({ enabled: savedEnabled }) => {
      if (storageVersion === initialVersion) setEnabled(savedEnabled);
    })
    .catch((error) => {
      console.warn("ReadEasily: could not read toggle setting", error);
      setEnabled(false);
    });

  function updateSelectionButton() {
    if (!enabled) {
      actionButton.hidden = true;
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || text.length > MAX_TEXT_LENGTH || !selection?.rangeCount) {
      actionButton.hidden = true;
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) {
      actionButton.hidden = true;
      return;
    }

    selectedText = text;
    const left = Math.max(SCREEN_MARGIN, Math.min(rect.right, window.innerWidth - 130));
    const top = Math.max(SCREEN_MARGIN, Math.min(rect.bottom + 8, window.innerHeight - 44));
    actionButton.style.left = `${left}px`;
    actionButton.style.top = `${top}px`;
    actionButton.hidden = false;
  }

  function positionResultPanel() {
    if (resultPanel.hidden || !enabled) return;

    const buttonLeft = parseFloat(actionButton.style.left) || SCREEN_MARGIN;
    const buttonTop = parseFloat(actionButton.style.top) || SCREEN_MARGIN;
    const { width, height } = resultPanel.getBoundingClientRect();
    const left = Math.max(SCREEN_MARGIN, Math.min(buttonLeft, window.innerWidth - width - SCREEN_MARGIN));
    const below = buttonTop + 38;
    const above = buttonTop - height - SCREEN_MARGIN;
    const maxTop = Math.max(SCREEN_MARGIN, window.innerHeight - height - SCREEN_MARGIN);

    let top;
    if (below + height <= window.innerHeight - SCREEN_MARGIN) {
      top = below;
    } else if (above >= SCREEN_MARGIN) {
      top = above;
    } else {
      top = Math.max(SCREEN_MARGIN, Math.min(below, maxTop));
    }
    resultPanel.style.left = `${left}px`;
    resultPanel.style.top = `${top}px`;
  }

  function showResult(message, version) {
    if (!enabled || version !== requestVersion) return;
    resultText.textContent = message;
    resultPanel.hidden = false;
    positionResultPanel();
  }

  document.addEventListener("mouseup", (event) => {
    if (actionButton.contains(event.target) || resultPanel.contains(event.target)) return;
    updateSelectionButton();
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") {
      actionButton.hidden = true;
      resultPanel.hidden = true;
      return;
    }
    updateSelectionButton();
  });

  document.addEventListener("mousedown", (event) => {
    if (actionButton.contains(event.target) || resultPanel.contains(event.target)) return;
    actionButton.hidden = true;
  });

  window.addEventListener("scroll", () => {
    actionButton.hidden = true;
  }, true);
  window.addEventListener("resize", positionResultPanel);

  actionButton.addEventListener("mousedown", (event) => {
    event.preventDefault(); // Preserve the user's text highlight.
  });

  actionButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!enabled || !selectedText) return;

    const textToProcess = selectedText;
    const version = ++requestVersion;
    actionButton.hidden = true;

    try {
      // Check the latest saved state before sending any selected text to the API.
      const settings = await chrome.storage.local.get({ enabled: true });
      if (settings.enabled !== true) {
        setEnabled(false);
        return;
      }
      if (!enabled || version !== requestVersion) return;

      showResult("Simplifying text…", version);
      const reply = await chrome.runtime.sendMessage({
        type: "PROCESS_TEXT",
        text: textToProcess
      });
      if (!enabled || version !== requestVersion) return;

      if (!reply?.ok) {
        showResult(`Error: ${reply?.error || "No response received."}`, version);
        return;
      }
      if (typeof reply.result !== "string" || !reply.result.trim()) {
        showResult("Could not simplify this text. Please try again.", version);
        return;
      }
      showResult(`Simplified text:\n${reply.result}`, version);
    } catch (error) {
      if (!enabled || version !== requestVersion) return;
      const message = error.message?.includes("Extension context invalidated")
        ? "Extension updated. Refresh this webpage and try again."
        : `Extension communication error: ${error.message}`;
      showResult(message, version);
    }
  });

  closeButton.addEventListener("click", () => {
    requestVersion += 1; // A late response must not reopen a panel the user closed.
    resultPanel.hidden = true;
  });
})();
