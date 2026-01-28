import { redirect } from "@sveltejs/kit";

export function load() {
  // IA config UI was removed; send users back to dashboard.
  throw redirect(307, "/app");
}
