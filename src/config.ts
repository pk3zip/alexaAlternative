import { config as denv_config } from "dotenv";
import z from "zod";

denv_config({
  quiet: true,
});

export const configSchema = z.object({
  ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-[a-zA-Z0-9_-]+$/),
  MODEL: z.string().default("claude-3-5-sonnet-20240620"),
  AGENT_NAME: z.string().default("riker"),
  WHISPER_CLI_PATH: z
    .string()
    .default("vendor/whisper.cpp/build/bin/whisper-cli"),
  WHISPER_MODEL_PATH: z
    .string()
    .default("vendor/whisper.cpp/models/ggml-base.en.bin"),
  STORAGE_PATH: z.string().default("persistant.json"),
});

export type configType = z.infer<typeof configSchema>;

export const config = (function (env = process.env): configType {
  const data = configSchema.safeParse(env);
  if (!data.success) {
    console.error(z.prettifyError(data.error));
    process.exit(1);
  } else {
    return data.data;
  }
})();
