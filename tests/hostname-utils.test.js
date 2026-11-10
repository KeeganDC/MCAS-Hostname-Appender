"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildRedirectRule,
  buildRedirectRules,
  getHostPermissionOrigins,
  normalizeAllowlist,
  normalizeHostname,
} = require("../hostname-utils.js");

test("normalizes a bare hostname and full HTTP(S) URL", () => {
  assert.deepEqual(normalizeHostname(" Contoso.SharePoint.com. "), {
    ok: true,
    value: "contoso.sharepoint.com",
  });
  assert.deepEqual(normalizeHostname("https://Contoso.SharePoint.com:8443/path?q=1#part"), {
    ok: true,
    value: "contoso.sharepoint.com",
  });
});

test("normalizes Unicode URLs to their DNS representation", () => {
  assert.deepEqual(normalizeHostname("https://bücher.example/path"), {
    ok: true,
    value: "xn--bcher-kva.example",
  });
});

test("rejects unsafe, unsupported, and already proxied inputs", () => {
  for (const input of [
    "",
    "ftp://contoso.sharepoint.com",
    "https://user:password@contoso.sharepoint.com",
    "192.0.2.10",
    "https://contoso.sharepoint.com.mcas.ms",
    "mcas.ms",
  ]) {
    assert.equal(normalizeHostname(input).ok, false, input);
  }
});

test("deduplicates and sorts normalized allowlist hostnames", () => {
  assert.deepEqual(
    normalizeAllowlist([
      "https://B.example/path",
      "a.example",
      "b.example",
      "https://b.example.mcas.ms",
      "",
    ]),
    ["a.example", "b.example"],
  );
});

test("requests access only for the selected hostname and its proxy address", () => {
  assert.deepEqual(getHostPermissionOrigins("contoso.sharepoint.com"), [
    "http://contoso.sharepoint.com/*",
    "https://contoso.sharepoint.com/*",
    "http://contoso.sharepoint.com.mcas.ms/*",
    "https://contoso.sharepoint.com.mcas.ms/*",
  ]);
});

test("constructs an exact-host, top-level redirect rule that changes only the host", () => {
  const rule = buildRedirectRule("contoso.sharepoint.com", 73);
  const matcher = new RegExp(rule.condition.regexFilter);

  assert.deepEqual(rule.action, {
    type: "redirect",
    redirect: {
      transform: {
        host: "contoso.sharepoint.com.mcas.ms",
      },
    },
  });
  assert.deepEqual(rule.condition.resourceTypes, ["main_frame"]);
  assert.match("https://contoso.sharepoint.com/library/item?view=1", matcher);
  assert.match("http://contoso.sharepoint.com:8080/path", matcher);
  assert.doesNotMatch("https://sub.contoso.sharepoint.com/path", matcher);
  assert.doesNotMatch("https://contoso.sharepoint.com.evil.example/path", matcher);
  assert.doesNotMatch("https://contoso.sharepoint.com.mcas.ms/path", matcher);
});

test("builds stable, unique rules from a duplicate allowlist", () => {
  const first = buildRedirectRules(["b.example", "a.example", "B.example"]);
  const second = buildRedirectRules(["a.example", "b.example"]);

  assert.equal(first.length, 2);
  assert.equal(new Set(first.map((rule) => rule.id)).size, 2);
  assert.deepEqual(first, second);
});
