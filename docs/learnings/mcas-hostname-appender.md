# MCAS Hostname Appender learnings

Implementation details and historical lessons specific to this repository. For reusable Chrome guidance, see [General Chrome extension learnings](chrome-extensions.md).

## Hostname and redirect behavior

- Treat the allowlist as normalized hostnames, not URL prefixes. Full URL input is reduced to its hostname; paths, queries, fragments, and input ports do not limit the entry. Each entry covers both HTTP and HTTPS and navigations on optional ports.
- Normalize at the boundary: trim whitespace, lowercase, strip trailing dots, and use URL parsing so internationalized names become ASCII punycode. Deduplicate and sort entries.
- Reject unsupported schemes, credentials, IP addresses, invalid DNS names, and already-proxied names.
- Match the exact hostname with an escaped, anchored pattern and an authority boundary. Include an optional port, but do not match subdomains, lookalike domains, or the appended proxy hostname.
- Transform only the host to `<hostname>.mcas.ms`. The rule does not reconstruct the URL; however, unit tests do not verify a live Chrome navigation or its handling of every URL component.
- Redirect rules affect subsequent eligible top-level navigations, not subresources. Adding or removing an entry does not navigate an already-open tab or undo its current URL.
- Appending `.mcas.ms` does not configure Defender for Cloud Apps, authenticate a tenant, or guarantee that an arbitrary website is supported by that proxy.

## Permissions and rule state

- Request access for the selected hostname and its matching `.mcas.ms` hostname, over both HTTP and HTTPS. Broad `optional_host_permissions` patterns permit prompting; they do not grant access at install time.
- Keep permission requests tied to a popup user action. A denied request does not add the site. A saved entry without the required grants is shown as access-paused and excluded from generated rules.
- On removal, remove the entry and its rule, then revoke its associated optional access. The service worker also reconciles rules when Chrome permissions change.
- `activeTab` supports current-tab quick-add without broad browsing-history access.
- The service worker has a 5,000-entry application guard. This is not a measured browser-supported capacity; Chrome's dynamic-rule and regex quotas still apply.

## Validation and project history

- The seven Node tests cover hostname normalization, permission-origin construction, exact-match regex behavior, and redirect-rule construction and stability. Syntax checks and manifest parsing do not replace automated Chrome popup/permission tests or a live MCAS navigation test.
- During initial development, deliverables existed only in a disposable worktree and were lost when it was archived. Persist work in the intended repository before archiving; if Chrome reports a missing manifest, verify `manifest.json` in the exact directory selected for loading.
- The v1.0.0 release archive was built from its tag and contains one top-level folder with `manifest.json` and runtime files, without `.git`. The README's release installation steps direct users to select that extracted folder.
- Git transport and GitHub API authentication are independent. If pushing succeeds but release publication fails, check the selected GitHub account; never put tokens, account-specific environment names, or machine-local paths in project documentation.
