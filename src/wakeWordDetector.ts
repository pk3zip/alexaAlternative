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
    const lower = input.toLowerCase().trim();
    // Using a regex with word boundaries (\b) is much more robust
    const regex = new RegExp(`\\b${this.wake_word}\\b`, "i");
    return regex.test(lower);
  }

  extractCommand(input: string): string | null {
    const lower = input.toLowerCase().trim();
    const index = lower.indexOf(this.wake_word);

    if (index === -1) return null;

    // Remove everything before and including the wake word
    let command = lower.substring(index + this.wake_word.length).trim();
    
    // Remove leading punctuation common in transcripts
    command = command.replace(/^[,.?!:;]+/, "").trim();
    
    return command.length > 0 ? command : null;
  }

  get word() {
    return this.wake_word;
  }
}
