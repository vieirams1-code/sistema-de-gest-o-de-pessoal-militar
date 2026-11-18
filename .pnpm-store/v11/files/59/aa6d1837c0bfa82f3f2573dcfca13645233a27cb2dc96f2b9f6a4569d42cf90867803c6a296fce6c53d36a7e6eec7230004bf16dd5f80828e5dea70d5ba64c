import { AxiosInstance } from "axios";
import { VoiceModule } from "./voice.types.js";
/**
 * Options for {@linkcode createVoiceModule}.
 *
 * @internal
 */
export interface VoiceModuleConfig {
    /** Sent as `Base44-Functions-Version` so the backend can pick the draft MCP profile. */
    functionsVersion?: string;
}
/**
 * Creates the Voice module for the Base44 SDK.
 *
 * The module passes every value through unchanged. Base44 validates them, so
 * a backend rule change never needs an SDK release.
 *
 * @param axios - Axios instance (should be service role client)
 * @param config - Module configuration
 * @returns Voice module with methods to create and end live voice sessions
 * @internal
 */
export declare function createVoiceModule(axios: AxiosInstance, { functionsVersion }?: VoiceModuleConfig): VoiceModule;
