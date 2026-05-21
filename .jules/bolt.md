## 2024-05-24 - [Debouncing DOM and Map Renders]
**Learning:** Found a specific performance bottleneck in `mapa_emel.html` where complex DOM re-renders (destroying and recreating map markers and HTML cards) were triggered synchronously on every keystroke (`keyup`) due to lack of debouncing.
**Action:** When implementing search or filtering that updates heavy UI components (like Leaflet maps or lists), always apply a ~300ms debounce to the event handler to batch the updates and prevent main thread blocking.
