import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";

const TOKEN_KEY = "qforge_token";

export const authToken = writable(browser ? localStorage.getItem(TOKEN_KEY) : null);

authToken.subscribe((value) => {
  if (!browser) return;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
});

export const isAuthed = derived(authToken, (t) => Boolean(t));

export function logout() {
  authToken.set(null);
}
