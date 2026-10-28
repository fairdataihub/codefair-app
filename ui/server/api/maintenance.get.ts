/**
 * GET /api/maintenance
 *
 * Public. Lists the workflows an admin has paused so the client can show a
 * notice and disable the matching buttons before anyone sends a request that
 * would be rejected.
 */
import { getActiveMaintenance } from "~/server/utils/maintenance";

export default defineEventHandler(async () => {
  const active = await getActiveMaintenance();

  return { active };
});
