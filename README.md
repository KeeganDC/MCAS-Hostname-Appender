# MCAS Hostname Appender

MCAS Hostname Appender is a Chrome Manifest V3 extension that appends `.mcas.ms` only to website hostnames you explicitly allowlist. It is the inverse of an auto-remover: a site is left unchanged unless you add its exact hostname in the popup.

## Install unpacked in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository root directory: the folder that contains `manifest.json`.
6. Optionally pin **MCAS Hostname Appender** from Chrome's Extensions menu for faster access.

## Use

1. Open the extension popup.
2. Enter a hostname such as `contoso.sharepoint.com`, or a full HTTP(S) URL such as `https://contoso.sharepoint.com/sites/team`.
3. Select **Add site** and approve the narrow site-access prompt.
4. Future top-level HTTP(S) navigations to that hostname redirect to the same URL with `.mcas.ms` appended to its host.

The **Current tab** card adds the active page's hostname when the page is an eligible HTTP(S) website. Use **Remove** to disable a hostname and revoke the optional access previously granted for that hostname and its proxy address.

## Exact hostname behavior

The allowlist is exact. Adding `contoso.sharepoint.com` redirects:

```text
https://contoso.sharepoint.com/sites/team?view=1#news
```

to:

```text
https://contoso.sharepoint.com.mcas.ms/sites/team?view=1#news
```

The protocol, optional port, path, query string, and fragment are preserved. It does **not** redirect `sub.contoso.sharepoint.com`, other lookalike domains, or any hostname already ending in `.mcas.ms`. Redirect rules apply only to top-level page navigations, not subresources.

## Privacy

This extension has no analytics, tracking, network calls, remote configuration, or browsing-history collection. The allowlist is stored locally in Chrome extension storage on the current device. Chrome performs the redirects declaratively; the extension does not inspect page content or transmit the websites you visit.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Saves the local allowlist. |
| `activeTab` | Reads the active tab's URL only after you open the popup, enabling the current-tab quick-add action without broad browsing access. |
| `declarativeNetRequestWithHostAccess` | Installs local browser redirect rules after access has been granted for a site. |
| Optional HTTP(S) host access | Chrome prompts only when you add a hostname. The prompt covers that selected hostname and its corresponding `.mcas.ms` proxy address, for HTTP and HTTPS. Removing the hostname revokes this optional access. |

The manifest does not declare blanket site access in `host_permissions`; the broad patterns in `optional_host_permissions` only allow Chrome to request the individual origins selected in the popup.

## Development checks

This project has no package dependencies. With a current Node.js installation:

```bash
npm run check
npm test
```

The tests cover hostname/URL normalization, exact-host matching, permission-origin construction, and declarative redirect-rule construction.
