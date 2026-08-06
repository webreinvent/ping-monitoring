import { updateClientName, toClientResponse } from "../../utils/client";
import { broadcastClientNameUpdated } from "../../ws/ping";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing slug parameter" });
  }

  const body = (await readBody(event)) as { name?: unknown } | null;
  const { name } = body ?? {};

  // Validate: must be a string
  if (typeof name !== "string") {
    throw createError({
      statusCode: 400,
      message: "Name is required and must be between 1 and 100 characters",
    });
  }

  // Trim and validate length: 1-100 chars, non-empty, non-whitespace
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw createError({
      statusCode: 400,
      message: "Name is required and must be between 1 and 100 characters",
    });
  }

  const row = updateClientName(slug, trimmed);
  if (!row) {
    throw createError({ statusCode: 404, message: "Client not found" });
  }

  // Broadcast to all connected WebSocket clients
  broadcastClientNameUpdated(row.slug, row.name);

  return toClientResponse(row);
});
