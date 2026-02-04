import axios from "axios";
import { get } from "svelte/store";
import { authToken } from "$lib/stores/auth";
import { currentUser } from "$lib/stores/user";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({ baseURL });

const SCOPED_PATHS = ["/labels", "/chapter-tags", "/folders"];

function shouldAttachUser(url = "") {
  // Remove baseURL if a full URL was passed
  const cleaned = url.startsWith(baseURL) ? url.slice(baseURL.length) : url;
  const path = cleaned.split("?")[0];
  return SCOPED_PATHS.some((p) => path.startsWith(p));
}

function withUserScope(config) {
  const user = get(currentUser);
  const userId = user?._id || user?.id;

  if (!userId || !config.url || !shouldAttachUser(config.url)) return config;

  const method = (config.method || "get").toLowerCase();

  if (method === "get" || method === "delete") {
    config.params = { ...(config.params || {}), userId };
  } else if (config.data instanceof FormData) {
    if (!config.data.has("userId")) config.data.append("userId", userId);
  } else {
    config.data = { ...(config.data || {}), userId };
  }

  return config;
}

api.interceptors.request.use((config) => {
  const token = get(authToken);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return withUserScope(config);
});
