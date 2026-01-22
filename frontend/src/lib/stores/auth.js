import { browser } from "$app/environment";
import { derived, writable } from "svelte/store";

const TOKEN_KEY = "qforge_token";

// Lê o token do localStorage apenas no browser
const initialToken = browser ? localStorage.getItem(TOKEN_KEY) : null;

export const authToken = writable(initialToken);

// Sincroniza o token com o localStorage
authToken.subscribe((value) => {
  if (!browser) return;
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
});

export const isAuthed = derived(authToken, ($token) => Boolean($token));

export function logout() {
  authToken.set(null);
  if (browser) {
    localStorage.removeItem(TOKEN_KEY);
    // força nova navegação para limpar estado da app
    window.location.href = "/login";
  }
}
