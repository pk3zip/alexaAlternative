// ttsManager.ts
import { KokoroTTS } from "kokoro-js";
import player from "play-sound";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export class TTSManager {
  private tts: KokoroTTS | null = null;
  // Warm up the model in the background immediately on construction
  // so the first speak() call isn't slow.
  private modelReady: Promise<void>;
  private audio = player();

  private constructor(private voice: string) {
    this.modelReady = this.loadModel();
  }

  static new(voice: string = "af_bella"): TTSManager {
    return new TTSManager(voice);
  }

  private async loadModel(): Promise<void> {
    console.log("Loading Kokoro TTS model (first run downloads ~300MB)...");
    this.tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8", // quantised — smaller and faster, negligible quality loss
      device: "cpu", // Node.js only supports cpu
    });
    console.log("Kokoro TTS ready.");
  }

  async speak(text: string): Promise<void> {
    // Wait for model to be ready if it isn't already
    await this.modelReady;

    const audio = await this.tts!.generate(text, { voice: this.voice });

    // Save to a temp file, play it, then delete it
    const tmpPath = join(tmpdir(), `kokoro-${Date.now()}.wav`);
    audio.save(tmpPath);
    await this.playAndDelete(tmpPath);
  }

  private playAndDelete(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audio.play(path, (err: Error | null) => {
        // Always clean up the temp file whether playback succeeded or not
        try {
          unlinkSync(path);
        } catch {}
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Call this to see all available voices
  async listVoices(): Promise<void> {
    await this.modelReady;
    console.log(this.tts!.list_voices());
  }
}
