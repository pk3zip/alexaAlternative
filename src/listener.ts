import { configType } from "./config";
import { microphoneCapture } from "./microphoneCapture";
import { wakeWordDetector } from "./wakeWordDetector";
import { exec } from "child_process";
import * as fs from "fs";
import * as util from "util";
import * as path from "path";
import VAD from "node-vad";
import { BuildExec } from "./buildExec";

const execPromise = util.promisify(exec);

const VAD_MODE = VAD.Mode.AGGRESSIVE;
const SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 30; // frames of silence before we consider speech ended
const FRAME_DURATION = 30; // ms per frame

export class listener {
  private mic: microphoneCapture;
  private detector: wakeWordDetector;
  private isListening: boolean = false;
  private vad: VAD;

  public onCommand: (command: string) => void = (command) => {
    console.log(`[listener] command ready: "${command}"`);
  };

  private constructor(private global_config: configType) {
    this.mic = microphoneCapture.new(global_config);
    this.detector = wakeWordDetector.new(global_config);
    this.vad = new VAD(VAD_MODE);
  }

  static new(global_config: configType): listener {
    return new listener(global_config);
  }

  private writeWavHeader(buffer: Buffer): Buffer {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + buffer.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(SAMPLE_RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(buffer.length, 40);
    return Buffer.concat([header, buffer]);
  }

  private async transcribe(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) return "";

      // -nt and --no-timestamps help get clean text
      const { stdout } =
        await BuildExec.new`${this.global_config.WHISPER_CLI_PATH} --model ${this.global_config.WHISPER_MODEL_PATH} -f ${filePath} --no-timestamps -nt`.run();

      // Remove any remaining metadata or noise from the output
      return stdout
        .replace(/\[.*?\]/g, "")
        .trim()
        .toLowerCase();
    } catch (err) {
      console.error("[transcribe] failed:", err);
      return "";
    }
  }

  private async captureUntilSilence(): Promise<string> {
    const tempPath = path.join(process.cwd(), `capture_${Date.now()}.wav`);

    return new Promise((resolve) => {
      const frames: Buffer[] = [];
      let silenceFrameCount = 0;
      let speechDetected = false;
      let isFinalizing = false;
      let buffer = Buffer.alloc(0);
      let isProcessing = false;

      const frameSize = ((SAMPLE_RATE * FRAME_DURATION) / 1000) * 2;

      const processBuffer = async () => {
        if (isProcessing || isFinalizing) return;
        isProcessing = true;

        while (buffer.length >= frameSize && !isFinalizing) {
          const frame = buffer.slice(0, frameSize);
          buffer = buffer.slice(frameSize);

          try {
            const result = await this.vad.processAudio(frame, SAMPLE_RATE);
            frames.push(frame);

            if (result === VAD.Event.VOICE) {
              if (!speechDetected) {
                console.log("[listener] speech detected...");
                speechDetected = true;
              }
              silenceFrameCount = 0;
            } else if (speechDetected) {
              silenceFrameCount++;
              if (silenceFrameCount >= SILENCE_THRESHOLD) {
                console.log("[listener] silence detected, finishing...");
                isFinalizing = true;
                await this.mic.stopRecording();

                const wavBuffer = this.writeWavHeader(Buffer.concat(frames));
                fs.writeFileSync(tempPath, wavBuffer);
                resolve(tempPath);
                break;
              }
            }
          } catch (err) {
            console.error("[listener] VAD error:", err);
          }
        }
        isProcessing = false;
      };

      this.mic.startRecording();
      this.mic.onData((chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        processBuffer();
      });
    });
  }

  async start(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;
    console.log(`[listener] listening for wake word: "${this.detector.word}"`);

    while (this.isListening) {
      try {
        const filePath = await this.captureUntilSilence();
        const transcript = await this.transcribe(filePath);

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (!transcript) continue;

        console.log(`[listener] heard: "${transcript}"`);

        if (this.detector.detect(transcript)) {
          const command = this.detector.extractCommand(transcript);
          if (command) {
            console.log(`[listener] wake word detected! command: "${command}"`);
            this.onCommand(command);
          }
        }
      } catch (err) {
        console.error("[listener] loop error:", err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  stop(): void {
    this.isListening = false;
  }
}
