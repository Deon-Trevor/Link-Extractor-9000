# Live search fixtures

`firefox-live-search.json` is a sanitized projection of public search-result DOM
observed in a temporary installation of the extension. It records URL-bearing
anchors, adapter scope matches, navigation landmarks, and expected canonical
URLs. Page text, cookies, browser-profile data, tracking tokens, and complete
HTML are deliberately excluded.

These fixtures are deterministic regression inputs, not proof that a platform
is still unchanged. Refresh them only after inspecting the live page in Firefox,
and retain the capture browser, timestamp, source route, and observed counts.
