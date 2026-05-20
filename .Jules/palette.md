## 2024-11-20 - Missing Utility Classes
**Learning:** Found that accessibility-focused utility classes like `.visually-hidden` were being used in the HTML markup (`mensagem.html`) to hide screen reader text (`#status-announcer`) but were never actually defined in the shared CSS (`style.css`), meaning the text was visibly exposed or broken.
**Action:** Always verify that utility classes referenced in markup are properly defined in the corresponding stylesheets, particularly those affecting accessibility visibility.
