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
    // Limpa tokens e rascunhos locais ao terminar sessão
    localStorage.removeItem(TOKEN_KEY);

    const draftPrefixes = ["question-draft-", "ai-generate-draft"];
    for (const key of Object.keys(localStorage)) {
      if (draftPrefixes.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }

    // força nova navegação para limpar estado da app
    window.location.href = "/login";
  }
}
