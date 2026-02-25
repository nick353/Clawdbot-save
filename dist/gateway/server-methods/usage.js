import { loadConfig } from "../../config/config.js";
import { loadCostUsageSummary } from "../../infra/session-cost-usage.js";
import { loadProviderUsageSummary } from "../../infra/provider-usage.js";
export const usageHandlers = {
    "usage.status": async ({ respond }) => {
        const summary = await loadProviderUsageSummary();
        respond(true, summary, undefined);
    },
    "usage.cost": async ({ respond }) => {
        const config = loadConfig();
        const summary = await loadCostUsageSummary({ days: 30, config });
        respond(true, summary, undefined);
    },
};
