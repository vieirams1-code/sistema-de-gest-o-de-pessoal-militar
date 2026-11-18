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
export function createVoiceModule(axios, { functionsVersion } = {}) {
    const endSession = async (sessionId) => {
        if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Session ID is required and must be a string");
        }
        await axios.delete(`/v1/voice-sessions/${encodeURIComponent(sessionId)}`);
    };
    return {
        async createSession(options) {
            // The app is derived from the service token, so the route isn't app-scoped.
            const response = await axios.post("/v1/voice-sessions", {
                sdp: options.sdp,
                mcp_profile_id: options.mcpProfileId,
                voice_instructions: options.voiceInstructions,
                agent_instructions: options.agentInstructions,
                // Send optional keys only when set, so the backend applies its defaults.
                ...(options.voiceModel !== undefined && {
                    voice_model: options.voiceModel,
                }),
                ...(options.agentModel !== undefined && {
                    agent_model: options.agentModel,
                }),
                ...(options.voice !== undefined && { voice: options.voice }),
                ...(options.initialMessages !== undefined && {
                    initial_messages: options.initialMessages,
                }),
            }, {
                // The backend picks the draft or published MCP profile from this
                // header. The service-role client doesn't send it by default.
                headers: functionsVersion
                    ? { "Base44-Functions-Version": functionsVersion }
                    : undefined,
            });
            const data = response;
            return {
                sessionId: data.session_id,
                sdp: data.sdp,
                expiresAt: data.expires_at,
                environment: data.environment,
            };
        },
        endSession,
    };
}
