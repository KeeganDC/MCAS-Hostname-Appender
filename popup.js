"use strict";

const {
  getHostPermissionOrigins,
  normalizeHostname,
} = globalThis.McasHostnameUtils;

const elements = {
  form: document.querySelector("#allowlist-form"),
  hostnameInput: document.querySelector("#hostname-input"),
  addButton: document.querySelector("#add-button"),
  feedback: document.querySelector("#form-feedback"),
  currentHostname: document.querySelector("#current-hostname"),
  currentSiteStatus: document.querySelector("#current-site-status"),
  addCurrentTab: document.querySelector("#add-current-tab"),
  allowlistCount: document.querySelector("#allowlist-count"),
  allowlistItems: document.querySelector("#allowlist-items"),
  emptyState: document.querySelector("#empty-state"),
};

let currentTabHostname = null;
let allowlistItems = [];

function pluralizeSites(count) {
  return `${count} ${count === 1 ? "site" : "sites"}`;
}

function setFeedback(message = "", state = "") {
  elements.feedback.textContent = message;
  if (state) {
    elements.feedback.dataset.state = state;
  } else {
    delete elements.feedback.dataset.state;
  }
}

function setFormBusy(isBusy) {
  elements.addButton.disabled = isBusy;
  elements.hostnameInput.disabled = isBusy;
  elements.addCurrentTab.disabled = isBusy || !currentTabHostname;
}

function setCurrentSiteStatus(label, state) {
  elements.currentSiteStatus.textContent = label;
  elements.currentSiteStatus.dataset.state = state;
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error || "The extension could not complete that request.");
  }

  return response;
}

function isAllowlisted(hostname) {
  return allowlistItems.some((item) => item.hostname === hostname);
}

function renderAllowlist(items) {
  allowlistItems = items;
  const count = items.length;
  elements.allowlistCount.textContent = pluralizeSites(count);
  elements.emptyState.hidden = count !== 0;
  elements.allowlistItems.replaceChildren();

  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.className = "allowlist-item";

    const main = document.createElement("div");
    main.className = "allowlist-item-main";

    const hostname = document.createElement("span");
    hostname.className = "site-hostname";
    hostname.textContent = item.hostname;

    const state = document.createElement("span");
    state.className = "site-state";
    state.dataset.state = item.enabled ? "active" : "paused";
    state.textContent = item.enabled ? "Active" : "Access paused";

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${item.hostname}`);
    removeButton.addEventListener("click", () => {
      void removeHostname(item.hostname, removeButton);
    });

    main.append(hostname, state);
    listItem.append(main, removeButton);
    elements.allowlistItems.append(listItem);
  }

  updateCurrentTabButton();
}

function updateCurrentTabButton() {
  if (!currentTabHostname) {
    elements.addCurrentTab.disabled = true;
    return;
  }

  const alreadyAdded = isAllowlisted(currentTabHostname);
  elements.addCurrentTab.disabled = alreadyAdded;
  elements.addCurrentTab.textContent = alreadyAdded
    ? "Current site is allowlisted"
    : "Add current site";
}

async function loadAllowlist() {
  const response = await sendMessage({ type: "getAllowlist" });
  renderAllowlist(response.items);
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const result = normalizeHostname(tab?.url || "");

    if (!result.ok) {
      currentTabHostname = null;
      elements.currentHostname.textContent = "This tab cannot be added.";
      setCurrentSiteStatus("Unavailable", "unavailable");
      elements.addCurrentTab.textContent = "Add current site";
      elements.addCurrentTab.disabled = true;
      return;
    }

    currentTabHostname = result.value;
    elements.currentHostname.textContent = currentTabHostname;
    setCurrentSiteStatus("Ready", "ready");
    updateCurrentTabButton();
  } catch {
    currentTabHostname = null;
    elements.currentHostname.textContent = "This tab cannot be read.";
    setCurrentSiteStatus("Unavailable", "unavailable");
    elements.addCurrentTab.disabled = true;
  }
}

async function requestHostAccess(hostname) {
  return chrome.permissions.request({
    origins: getHostPermissionOrigins(hostname),
  });
}

async function addHostname(input) {
  const result = normalizeHostname(input);
  if (!result.ok) {
    elements.hostnameInput.setAttribute("aria-invalid", "true");
    setFeedback(result.error, "error");
    return;
  }

  const hostname = result.value;
  elements.hostnameInput.removeAttribute("aria-invalid");
  setFormBusy(true);
  setFeedback("Requesting site access…");

  try {
    const granted = await requestHostAccess(hostname);
    if (!granted) {
      setFeedback("Site access was not granted, so the site was not added.", "error");
      return;
    }

    const response = await sendMessage({ type: "addHostname", hostname });
    renderAllowlist(response.items);
    elements.form.reset();
    setFeedback(
      response.added
        ? `${hostname} is now allowlisted.`
        : `${hostname} is already allowlisted.`,
      "success",
    );
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : "The site could not be added.",
      "error",
    );
  } finally {
    setFormBusy(false);
    updateCurrentTabButton();
  }
}

async function removeHostname(hostname, button) {
  button.disabled = true;
  setFeedback(`Removing ${hostname}…`);

  try {
    const response = await sendMessage({ type: "removeHostname", hostname });
    renderAllowlist(response.items);
    setFeedback(
      response.removed ? `${hostname} was removed.` : `${hostname} is not allowlisted.`,
      "success",
    );
  } catch (error) {
    button.disabled = false;
    setFeedback(
      error instanceof Error ? error.message : "The site could not be removed.",
      "error",
    );
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void addHostname(elements.hostnameInput.value);
});

elements.addCurrentTab.addEventListener("click", () => {
  if (currentTabHostname) {
    void addHostname(currentTabHostname);
  }
});

Promise.all([loadAllowlist(), loadCurrentTab()]).catch((error) => {
  setFeedback(
    error instanceof Error ? error.message : "The extension could not load its settings.",
    "error",
  );
});
