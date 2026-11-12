import { invoke } from "@tauri-apps/api/core";

import { isTauri } from "./platform";

const API_BASE_URL = "http://127.0.0.1:8000/";
const API_ORIGIN = new URL(API_BASE_URL).origin;

let apiToken: Promise<string> | undefined;

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isTauri) {
    throw new Error("The Ness API is only available from the Tauri app");
  }

  const url = new URL(path, API_BASE_URL);
  if (url.origin !== API_ORIGIN) {
    throw new Error("Ness API requests must target the local API");
  }

  if (!apiToken) {
    apiToken = invoke<string>("get_api_token").catch((error: unknown) => {
      apiToken = undefined;
      throw error;
    });
  }

  const token = await apiToken;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...init, headers });
}
