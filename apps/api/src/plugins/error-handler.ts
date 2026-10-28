/**
 * plugins/error-handler.ts — Fastify error handler plugin.
 *
 * Converts AppError and Zod/Fastify validation errors into the exact JSON
 * error envelope defined in README §14.4:
 *
 *   { error: { code, message, requestId, retryable } }
 *
 * Pino log calls:
 *  - AppError → warn (expected business errors)
 *  - Validation error → warn
 *  - Unhandled → error (never logs personal data per README §22.4)
 */

import type { FastifyInstance, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "./errors.js";

export const errorHandlerPlugin = fp(
  async (app: FastifyInstance) => {
    app.setErrorHandler((err, request, reply) => {
      const requestId = request.id;

      // ── Typed application error ──────────────────────────────────────
      if (err instanceof AppError) {
        app.log.warn({ code: err.code, requestId }, `AppError: ${err.message}`);
        return reply.status(err.httpStatus).send({
          error: {
            code: err.code,
            message: err.message,
            requestId,
            retryable: err.retryable,
          },
        });
      }

      // ── Fastify / Zod schema validation error (400) ──────────────────
      const fastifyErr = err as FastifyError;
      if (fastifyErr.statusCode === 400) {
        app.log.warn(
          { code: "VALIDATION_ERROR", requestId },
          `Validation: ${err.message}`,
        );
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: err.message,
            requestId,
            retryable: false,
          },
        });
      }

      // ── Unhandled server error ────────────────────────────────────────
      app.log.error({ requestId }, `Unhandled: ${err.message}`);
      return reply.status(500).send({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
          requestId,
          retryable: false,
        },
      });
    });
  },
  { name: "error-handler" },
);
