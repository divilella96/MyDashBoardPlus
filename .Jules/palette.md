
## 2024-05-21 - [Accessibility] Missing utility classes
**Learning:** Found elements in the DOM with classes like `.visually-hidden` that were not actually defined in the stylesheet. This causes elements meant only for screen readers to visibly render on screen, creating confusion.
**Action:** Always verify that utility classes referenced in HTML actually exist in the CSS file, and consider standardizing a base set of accessibility classes for every project.
## 2024-11-20 - Missing Utility Classes
**Learning:** Found that accessibility-focused utility classes like `.visually-hidden` were being used in the HTML markup (`mensagem.html`) to hide screen reader text (`#status-announcer`) but were never actually defined in the shared CSS (`style.css`), meaning the text was visibly exposed or broken.
**Action:** Always verify that utility classes referenced in markup are properly defined in the corresponding stylesheets, particularly those affecting accessibility visibility.
