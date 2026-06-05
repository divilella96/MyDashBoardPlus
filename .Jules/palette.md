## 2026-05-22 - Missing Accessibility Utility Classes
**Learning:** Invanilla HTML/CSS projects, utility classes like `.visually-hidden` must be manually defined in the stylesheet. Simply adding them to the HTML is insufficient and will result in screen reader text becoming visible on the screen.
**Action:** Always ensure that when using utility classes for accessibility (like `.visually-hidden`) or state (like `:focus-visible`), their definitions are explicitly added to the global `style.css`.

## 2024-05-21 - [Accessibility] Missing utility classes
**Learning:** Found elements in the DOM with classes like `.visually-hidden` that were not actually defined in the stylesheet. This causes elements meant only for screen readers to visibly render on screen, creating confusion.
**Action:** Always verify that utility classes referenced in HTML actually exist in the CSS file, and consider standardizing a base set of accessibility classes for every project.
## 2024-11-20 - Missing Utility Classes
**Learning:** Found that accessibility-focused utility classes like `.visually-hidden` were being used in the HTML markup (`mensagem.html`) to hide screen reader text (`#status-announcer`) but were never actually defined in the shared CSS (`style.css`), meaning the text was visibly exposed or broken.
**Action:** Always verify that utility classes referenced in markup are properly defined in the corresponding stylesheets, particularly those affecting accessibility visibility.

## 2024-11-20 - [Accessibility] Replacing alert() with Accessible Inline Validation
**Learning:** Found that form validation in `aviso_atraso.html` relied on blocking `alert()` calls, which provide a poor user experience and are not accessible to screen readers natively tied to the form field. The pattern for this app is to connect validation directly to inputs.
**Action:** Always replace blocking `alert()` validation with polite inline error containers connected to the input via `aria-describedby` and dynamically toggle `aria-invalid="true"` while shifting focus (`.focus()`) to the invalid input.
