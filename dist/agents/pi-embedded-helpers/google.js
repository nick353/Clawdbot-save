import { sanitizeGoogleTurnOrdering } from "./bootstrap.js";
export function isGoogleModelApi(api) {
    return (api === "google-gemini-cli" || api === "google-generative-ai" || api === "google-antigravity");
}
export function isAntigravityClaude(api, modelId) {
    if (api !== "google-antigravity")
        return false;
    return modelId?.toLowerCase().includes("claude") ?? false;
}
export { sanitizeGoogleTurnOrdering };
