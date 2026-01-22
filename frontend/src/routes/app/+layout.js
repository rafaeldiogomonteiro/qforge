export const ssr = false;
export const csr = true;

import { get } from "svelte/store";
import { authToken } from "$lib/stores/auth";
import { redirect } from "@sveltejs/kit";

export function load() {
  const token = get(authToken);
  if (!token) throw redirect(302, "/login");
}
