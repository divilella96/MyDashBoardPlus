## 2025-02-14 - Accessible Icon-Only Buttons in Vanilla JS

**Learning:** When dynamically generating icon-only buttons via JavaScript (like the 'X' remove button in `comunicacao_bot.html`), accessibility attributes are often overlooked because the HTML structure isn't visible in the template. Screen readers will just announce "X, button" which is confusing out of context.

**Action:** Always explicitly set `aria-label` and `title` attributes using `setAttribute('aria-label', '...')` and `.title = '...'` when calling `document.createElement('button')` for icon-only buttons to ensure proper screen reader support and visual tooltips.
