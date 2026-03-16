import { configType } from "./config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class microphoneCapture {
  private isRecording: boolean = false;
  private recordingProcess: ReturnType<typeof spawn> | null = null;
  private outputPath: string;

  private constructor(private global_config: configType) {
    this.outputPath = path.join(process.cwd(), "capture.wav");
  }

  static new(global_config: configType): microphoneCapture {
    return new microphoneCapture(global_config);
  }

  startRecording(): void {
    if (this.isRecording) return;

    this.isRecording = true;

    // arecord is standard on Linux ALSA — works on most SBCs out of the box
    this.recordingProcess = spawn("arecord", [
      "-D",
      "default",
      "-f",
      "S16_LE", // 16-bit signed little endian
      "-r",
      "16000", // 16khz — good for speech recognition
      "-c",
      "1", // mono — fine for wake word detection
      this.outputPath,
    ]);

    this.recordingProcess.stderr?.on("data", (data) => {
      console.error(`[mic error]: ${data}`);
    });

    this.recordingProcess.on("close", (code) => {
      this.isRecording = false;
      console.log(`[mic] recording stopped with code ${code}`);
    });
  }

  stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recordingProcess || !this.isRecording) {
        reject(new Error("No active recording"));
        return;
      }

      this.recordingProcess.on("close", () => {
        if (fs.existsSync(this.outputPath)) {
          resolve(this.outputPath);
        } else {
          reject(new Error("Recording file not found after stop"));
        }
      });

      this.recordingProcess.kill("SIGTERM");
    });
  }

  get recording() {
    return this.isRecording;
  }

  get filePath() {
    return this.outputPath;
  }
}
