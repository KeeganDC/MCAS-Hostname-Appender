"use strict";

importScripts("hostname-utils.js");

const {
  buildRedirectRules,
  getHostPermissionOrigins,
  normalizeAllowlist,
  normalizeHostname,
} = globalThis.McasHostnameUtils;

const STORAGE_KEY = "allowlistedHostnames";
const MAX_ALLOWLIST_ENTRIES = 5_000;
let synchronizationQueue = Promise.resolve();

async function readAllowlist() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return normalizeAllowlist(stored[STORAGE_KEY]);
}

async function hasHostAccess(hostname) {
  return chrome.permissions.contains({
    origins: getHostPermissionOrigins(hostname),
  });
}

async function getAllowlistItems() {
  const hostnames = await readAllowlist();
  return Promise.all(
    hostnames.map(async (hostname) => ({
      hostname,
      enabled: await hasHostAccess(hostname),
    })),
  );
}

async function synchronizeDynamicRules() {
  const hostnames = await readAllowlist();
  const hostAccess = await Promise.all(
    hostnames.map(async (hostname) => ({
      hostname,
      granted: await hasHostAccess(hostname),
    })),
  );
  const enabledHostnames = hostAccess
    .filter(({ granted }) => granted)
    .map(({ hostname }) => hostname);
  const rules = buildRedirectRules(enabledHostnames);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.map(({ id }) => id),
    addRules: rules,
  });

  return { enabledHostnames, ruleCount: rules.length };
}

function queueRuleSynchronization() {
  const run = synchronizationQueue.then(synchronizeDynamicRules);
  synchronizationQueue = run.catch((error) => {
    console.error("Unable to synchronize MCAS redirect rules.", error);
  });

  return run;
}

async function addHostname(input) {
  const result = normalizeHostname(input);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const hostname = result.value;
  if (!(await hasHostAccess(hostname))) {
    throw new Error("Allow access to this site before adding it.");
  }

  const hostnames = await readAllowlist();
  if (hostnames.includes(hostname)) {
    return { items: await getAllowlistItems(), added: false };
  }

  if (hostnames.length >= MAX_ALLOWLIST_ENTRIES) {
    throw new Error(`The allowlist is limited to ${MAX_ALLOWLIST_ENTRIES} sites.`);
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: normalizeAllowlist([...hostnames, hostname]),
  });
  await queueRuleSynchronization();

  return { items: await getAllowlistItems(), added: true };
}

async function removeHostname(input) {
  const result = normalizeHostname(input);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const hostname = result.value;
  const hostnames = await readAllowlist();
  if (!hostnames.includes(hostname)) {
    return { items: await getAllowlistItems(), removed: false };
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: hostnames.filter((entry) => entry !== hostname),
  });
  await queueRuleSynchronization();
  await chrome.permissions.remove({
    origins: getHostPermissionOrigins(hostname),
  });

  return { items: await getAllowlistItems(), removed: true };
}

async function handleMessage(message) {
  switch (message?.type) {
    case "getAllowlist":
      return { items: await getAllowlistItems() };
    case "addHostname":
      return addHostname(message.hostname);
    case "removeHostname":
      return removeHostname(message.hostname);
    default:
      throw new Error("Unsupported extension request.");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) => {
      console.error("Unable to process MCAS Hostname Appender request.", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected extension error.",
      });
    });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    void queueRuleSynchronization();
  }
});

chrome.permissions.onAdded.addListener(() => {
  void queueRuleSynchronization();
});

chrome.permissions.onRemoved.addListener(() => {
  void queueRuleSynchronization();
});

chrome.runtime.onInstalled.addListener(() => {
  void queueRuleSynchronization();
});

chrome.runtime.onStartup.addListener(() => {
  void queueRuleSynchronization();
});
