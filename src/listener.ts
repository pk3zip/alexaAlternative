import { configType } from "./config";
import { microphoneCapture } from "./microphoneCapture";
import { wakeWordDetector } from "./wakeWordDetector";
import { exec } from "child_process";
import * as fs from "fs";
import * as util from "util";

const execPromise = util.promisify(exec);

export class listener {
  private mic: microphoneCapture;
  private detector: wakeWordDetector;
  private isListening: boolean = false;
  private chunkDuration: number = 3000; // ms to record per chunk

  private constructor(private global_config: configType) {
    this.mic = microphoneCapture.new(global_config);
    this.detector = wakeWordDetector.new(global_config);
  }

  static new(global_config: configType): listener {
    return new listener(global_config);
  }

  // Transcribes the wav file to text using whisper.cpp via CLI
  // This is the simplest offline option that works well on SBCs
  private async transcribe(filePath: string): Promise<string> {
    try {
      const { stdout } = await execPromise(
        `whisper-cli --model base.en --output-txt --file ${filePath}`,
      );
      return stdout.trim().toLowerCase();
    } catch (err) {
      console.error("[transcribe] failed:", err);
      return "";
    }
  }

  private async processChunk(): Promise<void> {
    this.mic.startRecording();

    await new Promise((resolve) => setTimeout(resolve, this.chunkDuration));

    const filePath = await this.mic.stopRecording();
    const transcript = await this.transcribe(filePath);

    console.log(`[listener] heard: "${transcript}"`);

    if (this.detector.detect(transcript)) {
      const command = this.detector.extractCommand(transcript);
      console.log(`[listener] wake word detected, command: "${command}"`);

      if (command) {
        this.onCommand(command);
      }
    }

    // Clean up wav file after processing
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Override this to hook into your assistant pipeline
  onCommand(command: string): void {
    console.log(`[listener] command ready to handle: "${command}"`);
  }

  async start(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;
    console.log(`[listener] listening for wake word: "${this.detector.word}"`);

    while (this.isListening) {
      await this.processChunk();
    }
  }

  stop(): void {
    this.isListening = false;
    console.log("[listener] stopped");
  }

  setChunkDuration(ms: number): void {
    this.chunkDuration = ms;
  }
}
