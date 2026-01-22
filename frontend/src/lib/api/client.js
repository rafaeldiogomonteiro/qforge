import axios from "axios";
import { get } from "svelte/store";
import { authToken } from "$lib/stores/auth";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = get(authToken);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
