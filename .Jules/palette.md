## 2026-05-28 - Replace Blocking Alerts with Accessible Inline Validation
**Learning:** Using native browser `alert()` for form validation creates a blocking, disruptive user experience and lacks necessary accessibility context.
**Action:** Replace `alert()` with inline validation using a dedicated error container that employs `aria-live='polite'` to announce errors to screen readers, and update the input field with `aria-invalid='true'` while maintaining visible text errors.
