## 2024-05-22 - [Debounce Frontend Map Search]
**Learning:** Complex DOM updates and Leaflet map re-renders triggered by `onkeyup` events (like in `mapa_emel.html`) cause severe UI lag if fired on every keystroke. This is a crucial codebase-specific bottleneck because the map updates boundaries dynamically while searching a large local JSON dataset.
**Action:** Always wrap event handlers that trigger complex DOM updates or map re-renders in a debounce function (e.g., `setTimeout` with ~300ms delay) to prevent blocking the main thread during typing.
## 2024-05-24 - [Debouncing DOM and Map Renders]
**Learning:** Found a specific performance bottleneck in `mapa_emel.html` where complex DOM re-renders (destroying and recreating map markers and HTML cards) were triggered synchronously on every keystroke (`keyup`) due to lack of debouncing.
**Action:** When implementing search or filtering that updates heavy UI components (like Leaflet maps or lists), always apply a ~300ms debounce to the event handler to batch the updates and prevent main thread blocking.
## 2024-05-20 - Debounce map search input
**Learning:** In a static HTML page relying heavily on DOM manipulation and Leaflet map rendering (e.g., `mapa_emel.html`), invoking rendering functions on every `keyup` event causes significant UI lag when typing.
**Action:** Always wrap search input handlers that trigger complex DOM updates or map re-renders with a debounce function (e.g., `setTimeout` / `clearTimeout` with ~300ms delay) to ensure performance remains smooth during user input.
