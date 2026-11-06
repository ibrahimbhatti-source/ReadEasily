// ReadEasily popup toggle. Compatible with the existing landing-page popup.html.
const enabledCheckbox = document.getElementById("enabled");

if (!enabledCheckbox) {
  console.error('ReadEasily: popup.html must contain <input id="enabled">.');
} else {
  const hasStorage = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

  if (!hasStorage) {
    // Allow viewing the popup as a local HTML page, without extension APIs.
    enabledCheckbox.checked = true;
  } else {
    enabledCheckbox.disabled = true;

    chrome.storage.local.get({ enabled: true })
      .then(({ enabled }) => {
        enabledCheckbox.checked = enabled === true;
      })
      .catch((error) => {
        console.error("ReadEasily: could not read setting", error);
      })
      .finally(() => {
        enabledCheckbox.disabled = false;
      });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.enabled) {
        enabledCheckbox.checked = changes.enabled.newValue === true;
      }
    });

    enabledCheckbox.addEventListener("change", async () => {
      const nextValue = enabledCheckbox.checked;
      enabledCheckbox.disabled = true;

      try {
        await chrome.storage.local.set({ enabled: nextValue });
      } catch (error) {
        console.error("ReadEasily: could not save setting", error);
        try {
          const { enabled } = await chrome.storage.local.get({ enabled: true });
          enabledCheckbox.checked = enabled === true;
        } catch (readError) {
          console.error("ReadEasily: could not restore setting", readError);
          enabledCheckbox.checked = !nextValue;
        }
      } finally {
        enabledCheckbox.disabled = false;
      }
    });
  }
}
