/**
 * apps/web/src/lib/api.ts
 *
 * Frontend API client instance for ONEiD (README §14, §17).
 */

import { createApiClient, OneIdClient } from "@oneid/shared";

// In the browser, relative path or NEXT_PUBLIC_API_URL
const apiUrl =
  typeof window !== "undefined"
    ? process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:4000"
    : process.env["API_URL"] || "http://localhost:4000";

export const api = createApiClient(apiUrl);
export { OneIdClient };
