// apps/api/src/lib/validation.js
import { ZodError } from "zod";

import { createError } from "./errors.js";

function zodIssuesToDetails(zodError) {
  /** @type {Record<string,string>} */
  const details = {};
  for (const issue of zodError.issues) {
    const path = issue.path?.length ? issue.path.join(".") : "_";
    // falls mehrere Issues auf einem Feld, erste behalten
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

/**
 * @template T
 * @param {import("zod").ZodSchema<T>} schema
 * @param {unknown} value
 * @returns {T}
 */
export function parseOrThrow(schema, value) {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError(
        "VALIDATION_ERROR",
        400,
        "Request validation failed",
        zodIssuesToDetails(err)
      );
    }
    throw err;
  }
}
