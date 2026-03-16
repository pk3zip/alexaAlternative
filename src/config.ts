import { config as denv_config } from "dotenv";
import z from "zod";

denv_config({
  quiet: true,
});

export const configSchema = z.object({
  ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-[a-zA-Z0-9_-]{93}$/),
  MODEL: z.string().default("claude-sonnet-4-6"),
  AGENT_NAME: z.string().default("riker"),
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
