/**
 * Opens the existing Intention form from a Journal reflection.
 *
 * Question 5 is a perspective, not an action, so it is never copied into the
 * form. The flag only asks the Intention screen to open a blank, editable form.
 */
const OPEN_BLANK_KEY = "intention_open_blank";
export const OPEN_INTENTIONS_EVENT = "zen-open-intentions";

export function openBlankIntention(): void {
  sessionStorage.setItem(OPEN_BLANK_KEY, "1");
  window.dispatchEvent(new CustomEvent(OPEN_INTENTIONS_EVENT));
}

/** Reads and clears the request so the blank form opens only once. */
export function takeBlankIntentionRequest(): boolean {
  const open = sessionStorage.getItem(OPEN_BLANK_KEY) === "1";
  sessionStorage.removeItem(OPEN_BLANK_KEY);
  return open;
}
