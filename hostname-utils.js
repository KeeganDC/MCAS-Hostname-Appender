(function exposeHostnameUtils(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.McasHostnameUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHostnameUtils() {
  "use strict";

  const PROXY_SUFFIX = ".mcas.ms";
  const MAX_RULE_ID = 2_147_483_647;

  function invalid(error) {
    return { ok: false, error };
  }

  function isIpv4Address(hostname) {
    const segments = hostname.split(".");

    return (
      segments.length === 4 &&
      segments.every(
        (segment) =>
          /^\d{1,3}$/.test(segment) &&
          Number.parseInt(segment, 10) >= 0 &&
          Number.parseInt(segment, 10) <= 255,
      )
    );
  }

  function isDnsHostname(hostname) {
    if (hostname.length > 253) {
      return false;
    }

    return hostname.split(".").every((label) => {
      if (label.length === 0 || label.length > 63) {
        return false;
      }

      return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
    });
  }

  function hasProtocolWithoutSlashes(value) {
    return /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value);
  }

  function normalizeHostname(input) {
    if (typeof input !== "string") {
      return invalid("Enter a hostname or an HTTP(S) URL.");
    }

    const value = input.trim();
    if (value.length === 0) {
      return invalid("Enter a hostname or an HTTP(S) URL.");
    }

    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    let urlValue;

    if (value.startsWith("//")) {
      urlValue = `https:${value}`;
    } else if (hasProtocol) {
      urlValue = value;
    } else if (hasProtocolWithoutSlashes(value)) {
      return invalid("URLs must use an HTTP(S) protocol such as https://.");
    } else {
      urlValue = `https://${value}`;
    }

    let url;
    try {
      url = new URL(urlValue);
    } catch {
      return invalid("Enter a valid hostname or HTTP(S) URL.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return invalid("Only HTTP and HTTPS websites can be allowlisted.");
    }

    if (url.username || url.password) {
      return invalid("URLs with a username or password are not supported.");
    }

    const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
    if (!hostname || !isDnsHostname(hostname) || isIpv4Address(hostname)) {
      return invalid("Enter a valid DNS hostname, not an IP address.");
    }

    if (hostname === "mcas.ms" || hostname.endsWith(PROXY_SUFFIX)) {
      return invalid("This hostname is already an MCAS proxy address.");
    }

    return { ok: true, value: hostname };
  }

  function normalizeAllowlist(hostnames) {
    if (!Array.isArray(hostnames)) {
      return [];
    }

    const normalized = new Set();
    for (const hostname of hostnames) {
      const result = normalizeHostname(hostname);
      if (result.ok) {
        normalized.add(result.value);
      }
    }

    return [...normalized].sort();
  }

  function getProxyHostname(hostname) {
    const result = normalizeHostname(hostname);
    if (!result.ok) {
      throw new TypeError(result.error);
    }

    return `${result.value}${PROXY_SUFFIX}`;
  }

  function getHostPermissionOrigins(hostname) {
    const result = normalizeHostname(hostname);
    if (!result.ok) {
      throw new TypeError(result.error);
    }

    const proxyHostname = `${result.value}${PROXY_SUFFIX}`;
    return [
      `http://${result.value}/*`,
      `https://${result.value}/*`,
      `http://${proxyHostname}/*`,
      `https://${proxyHostname}/*`,
    ];
  }

  function escapeForRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function makeRuleId(hostname, usedRuleIds) {
    let hash = 2_166_136_261;

    for (let index = 0; index < hostname.length; index += 1) {
      hash ^= hostname.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619) >>> 0;
    }

    let ruleId = (hash % MAX_RULE_ID) + 1;
    while (usedRuleIds.has(ruleId)) {
      ruleId = ruleId === MAX_RULE_ID ? 1 : ruleId + 1;
    }

    usedRuleIds.add(ruleId);
    return ruleId;
  }

  function buildRedirectRule(hostname, ruleId) {
    const result = normalizeHostname(hostname);
    if (!result.ok) {
      throw new TypeError(result.error);
    }

    if (!Number.isInteger(ruleId) || ruleId < 1 || ruleId > MAX_RULE_ID) {
      throw new RangeError("A redirect rule requires a valid positive rule ID.");
    }

    const normalizedHostname = result.value;
    return {
      id: ruleId,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          transform: {
            host: `${normalizedHostname}${PROXY_SUFFIX}`,
          },
        },
      },
      condition: {
        regexFilter: `^https?://${escapeForRegex(
          normalizedHostname,
        )}(?::[0-9]+)?(?:[/?#]|$)`,
        resourceTypes: ["main_frame"],
      },
    };
  }

  function buildRedirectRules(hostnames) {
    const normalizedHostnames = normalizeAllowlist(hostnames);
    const usedRuleIds = new Set();

    return normalizedHostnames.map((hostname) =>
      buildRedirectRule(hostname, makeRuleId(hostname, usedRuleIds)),
    );
  }

  return {
    PROXY_SUFFIX,
    MAX_RULE_ID,
    normalizeHostname,
    normalizeAllowlist,
    getProxyHostname,
    getHostPermissionOrigins,
    buildRedirectRule,
    buildRedirectRules,
  };
});
