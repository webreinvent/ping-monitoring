import { getAllMonitorsWithLatestState } from "../utils/monitors";
import { info, error as logError } from "../utils/logger";

export default defineEventHandler(() => {
  try {
    const monitors = getAllMonitorsWithLatestState();
    info("Monitors list requested", { count: monitors.length });
    return { monitors };
  } catch (err) {
    logError("Failed to fetch monitors list", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw createError({
      statusCode: 500,
      message: "Failed to fetch monitors list",
    });
  }
});
