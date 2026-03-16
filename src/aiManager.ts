import { configType } from "./config";
import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt } from "./systemPrompt";

type ToolCallback = (input: Record<string, unknown>) => Promise<string>;

// These are the provider-managed tool definitions.
// Anthropic runs them server-side — you don't write callbacks for them.
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
};

const WEB_FETCH_TOOL: Anthropic.WebFetchTool20250910 = {
  type: "web_fetch_20250910",
  name: "web_fetch",
};

export class AIManager {
  private constructor(
    private global_config: configType,
    private ai: Anthropic,
    private systemPrompt: systemPrompt,
    private tools: [Anthropic.Tool, ToolCallback][] = [],
    private history: Anthropic.MessageParam[] = [],
    private model: string = global_config.MODEL,
    private enableWebSearch: boolean = false,
    private enableWebFetch: boolean = false,
  ) {}

  public static new(global_config: configType, systemPrompt: systemPrompt) {
    const ai = new Anthropic({
      apiKey: global_config.ANTHROPIC_API_KEY,
    });
    return new AIManager(global_config, ai, systemPrompt);
  }

  // Call these to opt in to the built-in tools.
  enableWebSearchTool() {
    this.enableWebSearch = true;
    return this; // allows chaining: manager.enableWebSearchTool().enableWebFetchTool()
  }

  enableWebFetchTool() {
    this.enableWebFetch = true;
    return this;
  }

  registerTool(tool: Anthropic.Tool, callback: ToolCallback) {
    this.tools.push([tool, callback]);
  }

  // Returns all tools: your custom ones + any enabled provider tools.
  private getAllTools(): Anthropic.Messages.ToolUnion[] {
    const custom = this.tools.map(([tool]) => tool);
    const provider: Anthropic.Messages.ToolUnion[] = [];
    if (this.enableWebSearch) provider.push(WEB_SEARCH_TOOL);
    if (this.enableWebFetch) provider.push(WEB_FETCH_TOOL);
    return [...custom, ...provider];
  }

  private getCallback(name: string): ToolCallback | undefined {
    return this.tools.find(([tool]) => tool.name === name)?.[1];
  }

  private async executeToolUse(
    toolUseBlocks: Anthropic.ToolUseBlock[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    return Promise.all(
      toolUseBlocks.map(async (block) => {
        const callback = this.getCallback(block.name);
        if (!callback) {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: no handler registered for tool "${block.name}"`,
            is_error: true,
          };
        }
        try {
          const result = await callback(block.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: ${message}`,
            is_error: true,
          };
        }
      }),
    );
  }

  private extractText(response: Anthropic.Message): string {
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  async chat(
    messages: Anthropic.MessageParam[],
    maxTokens: number = 4096,
  ): Promise<string> {
    this.history.push(...messages);

    while (true) {
      const response = await this.ai.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        tools: this.getAllTools(),
        messages: this.history,
        system: await this.systemPrompt.getPrompt(),
      });

      this.history.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return this.extractText(response);
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        const toolResults = await this.executeToolUse(toolUseBlocks);
        this.history.push({ role: "user", content: toolResults });
        continue;
      }

      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }
  }
  clearHistory(): void {
    this.history = [];
  }
}
