import { getClientBySlug, toClientResponse } from "../../utils/client";

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing slug parameter" });
  }

  const row = getClientBySlug(slug);
  if (!row) {
    throw createError({ statusCode: 404, message: "Client not found" });
  }

  return toClientResponse(row);
});
