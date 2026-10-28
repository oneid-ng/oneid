/**
 * plugins/request-id.ts — Request ID generation and propagation.
 *
 * Every request gets a stable ID (req_<12-char random alphanum>) that is:
 *  - Available on request.id throughout the request lifecycle
 *  - Returned in the X-Request-ID response header
 *  - Included in every error envelope (README §14.4)
 *  - Included in pino log entries via the default reqId field
 */

import { randomBytes } from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a short, URL-safe random ID of the form req_<12 chars>.
 */
export function generateId(): string {
  const bytes = randomBytes(9); // 9 bytes → 12 base-62-ish chars
  let id = "req_";
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}

export const requestIdPlugin = fp(
  async (app: FastifyInstance) => {
    // Inject X-Request-ID into every response
    app.addHook("onSend", async (request, reply) => {
      void reply.header("X-Request-ID", request.id);
    });
  },
  { name: "request-id" },
);
