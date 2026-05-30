## 2026-05-22 - Missing Accessibility Utility Classes
**Learning:** Invanilla HTML/CSS projects, utility classes like `.visually-hidden` must be manually defined in the stylesheet. Simply adding them to the HTML is insufficient and will result in screen reader text becoming visible on the screen.
**Action:** Always ensure that when using utility classes for accessibility (like `.visually-hidden`) or state (like `:focus-visible`), their definitions are explicitly added to the global `style.css`.

## 2024-05-21 - [Accessibility] Missing utility classes
**Learning:** Found elements in the DOM with classes like `.visually-hidden` that were not actually defined in the stylesheet. This causes elements meant only for screen readers to visibly render on screen, creating confusion.
**Action:** Always verify that utility classes referenced in HTML actually exist in the CSS file, and consider standardizing a base set of accessibility classes for every project.
## 2024-11-20 - Missing Utility Classes
**Learning:** Found that accessibility-focused utility classes like `.visually-hidden` were being used in the HTML markup (`mensagem.html`) to hide screen reader text (`#status-announcer`) but were never actually defined in the shared CSS (`style.css`), meaning the text was visibly exposed or broken.
**Action:** Always verify that utility classes referenced in markup are properly defined in the corresponding stylesheets, particularly those affecting accessibility visibility.
## 2024-05-30 - Accessible Inline Validation
**Learning:** When dealing with dynamic form validation in vanilla HTML/JS, simply showing/hiding an error message visually (`style.display`) is insufficient for screen readers. Connecting the input to the error via `aria-describedby` and using `aria-live="polite"` on the error container, along with dynamically toggling `aria-invalid` on the input element itself, ensures that all users immediately understand when an input fails validation.
**Action:** Always implement this `aria-invalid` / `aria-describedby` / `aria-live` triad when building custom inline form validation instead of relying solely on visual cues or the native `alert()`.
