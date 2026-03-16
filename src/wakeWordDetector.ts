import { configType } from "./config";

export class wakeWordDetector {
  private wake_word: string;

  private constructor(private global_config: configType) {
    this.wake_word = global_config.AGENT_NAME.toLowerCase();
  }

  static new(global_config: configType): wakeWordDetector {
    return new wakeWordDetector(global_config);
  }

  detect(input: string): boolean {
    const words = input.toLowerCase().trim().split(/\s+/);
    return words.includes(this.wake_word);
  }

  extractCommand(input: string): string | null {
    const lower = input.toLowerCase().trim();
    const index = lower.indexOf(this.wake_word);

    if (index === -1) return null;

    const command = input.slice(index + this.wake_word.length).trim();
    return command.length > 0 ? command : null;
  }

  get word() {
    return this.wake_word;
  }
}
