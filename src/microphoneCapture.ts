import { configType } from "./config";
import { spawn } from "child_process";

export class microphoneCapture {
  private isRecording: boolean = false;
  private recordingProcess: ReturnType<typeof spawn> | null = null;
  private dataCallback: ((chunk: Buffer) => void) | null = null;

  private constructor(private global_config: configType) {}

  static new(global_config: configType): microphoneCapture {
    return new microphoneCapture(global_config);
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.dataCallback = callback;
  }

  startRecording(): void {
    if (this.isRecording) return;
    this.isRecording = true;

    this.recordingProcess = spawn(
      "arecord",
      ["-D", "default", "-t", "raw", "-f", "S16_LE", "-r", "16000", "-c", "1"],
      {
        stdio: ["ignore", "pipe", "ignore"], // ignore stderr entirely
      },
    );

    // Pipe raw audio to VAD via stdout as well as writing to file
    this.recordingProcess.stdout?.on("data", (chunk: Buffer) => {
      if (this.dataCallback) {
        this.dataCallback(chunk);
      }
    });

    this.recordingProcess.stderr?.on("data", (data) => {
      console.error(`[mic error]: ${data}`);
    });

    this.recordingProcess.on("close", () => {
      this.isRecording = false;
    });
  }

  stopRecording(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.recordingProcess || !this.isRecording) {
        resolve();
        return;
      }

      this.recordingProcess.once("close", () => {
        this.isRecording = false;
        resolve();
      });

      this.recordingProcess.kill("SIGINT");
    });
  }

  get recording() {
    return this.isRecording;
  }
}
