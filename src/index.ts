import { AIManager } from "./aiManager";
import { config } from "./config";
import { listener } from "./listener";
import { systemPrompt } from "./systemPrompt";
import { TTSManager } from "./ttsManager";

const agent = listener.new(config);
const prompt = systemPrompt.new(config);
const ai = AIManager.new(config, prompt)
  .enableWebFetchTool()
  .enableWebSearchTool();
const tts = TTSManager.new();
// POC — send command to Anthropic API
agent.onCommand = async (command: string) => {
  console.log(`[index] command received: "${command}"`);
  const response = await ai.chat([{ role: "user", content: command }]);
  console.log(`[index] response: "${response}"`);
  await tts.speak(response);
};

const shutdown = () => {
  console.log("\n[index] shutting down gracefully...");
  agent.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown); // ctrl+c
process.on("SIGTERM", shutdown); // kill command — important for SBC service management

console.log(`[index] starting ${config.AGENT_NAME}...`);
console.log(`[index] listening for wake word: "${config.AGENT_NAME}"`);

agent.start().catch((err) => {
  console.error("[index] fatal error:", err);
  process.exit(1);
});
