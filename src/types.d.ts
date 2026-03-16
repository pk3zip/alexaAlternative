declare module "node-vad" {
  namespace VAD {
    export enum Mode {
      NORMAL = 0,
      LOW_BITRATE = 1,
      AGGRESSIVE = 2,
      VERY_AGGRESSIVE = 3,
    }

    export enum Event {
      ERROR = -1,
      SILENCE = 0,
      VOICE = 1,
      NOISE = 2,
    }
  }

  class VAD {
    constructor(mode: VAD.Mode);
    processAudio(buffer: Buffer, sampleRate: number): Promise<VAD.Event>;
    static Mode: typeof VAD.Mode;
    static Event: typeof VAD.Event;
  }

  export = VAD;
}
