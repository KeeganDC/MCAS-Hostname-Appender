# General Chrome extension learnings

Reusable implementation and release lessons for Chrome extensions.

## Manifest V3 and dynamic rules

- Manifest V3 service workers are transient. Derive browser state such as dynamic rules from durable storage and current browser permissions, rather than relying on worker memory or popup lifetime.
- Reconcile dynamic rules after installation, browser startup, and relevant storage or permission changes. Serialize overlapping updates and replace the owned rule set in one browser API call.
- Prefer declarative request rules when the browser API can express the behavior. Restrict rules to the resource types that need them and match URL authorities precisely; avoid substring matching that can include subdomains or lookalike domains.
- When using a browser URL-transform API, change only the required URL component rather than manually rebuilding the whole URL. Test important URL components, including ports and fragments, in a real browser when they matter to the product.

## Permissions and user intent

- Optional permission patterns describe what an extension may request; they do not grant access at installation. Request optional access in response to a clear user action.
- Keep application intent (for example, a saved allowlist) separate from the browser's current permission grants. A saved setting should not silently imply that access remains granted; respond to permission revocation and exclude inaccessible entries from active browser rules.
- A denied permission request should not be reported as a successful configuration change.
- Use narrower permissions when possible. For example, `activeTab` can support a current-tab action without requiring broad access to browsing history or all sites.

## Privacy and validation

- Describe privacy behavior precisely. Declarative browser processing can avoid content scripts and page inspection, but redirected navigations still connect to their destinations.
- Keep pure unit tests, extension UI/permission tests, and live integration validation distinct. Passing utility tests does not establish that Chrome prompts, permissions, or real navigation behave as expected.
- Validate the exact claim being made. If URL preservation, browser quotas, or compatibility with an external service matters, test those in the browser or service environment rather than inferring them from rule construction.

## Packaging and installation

- Build release archives from an immutable tag, not a potentially dirty working directory. Include only the extension files needed to load it and avoid shipping repository metadata.
- For unpacked installation, direct users to select the extracted directory that directly contains `manifest.json`, not the ZIP or its parent. The selected directory must remain available after installation.
