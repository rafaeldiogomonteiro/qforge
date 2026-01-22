import { writable } from "svelte/store";
import { browser } from "$app/environment";

const KEY = "qforge_user";

export const currentUser = writable(browser ? JSON.parse(localStorage.getItem(KEY) || "null") : null);

currentUser.subscribe((v) => {
  if (!browser) return;
  if (v) localStorage.setItem(KEY, JSON.stringify(v));
  else localStorage.removeItem(KEY);
});
