/* Live Audio Stream — PenguinMod
 * Unsandboxed extension.
 * PCM16 little-endian, mono.
 */
(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("This extension requires unsandboxed mode.");
  }

  class LiveAudioStream {
    constructor() {
      this.sampleRate = 16000;
      this.chunkMs = 40;
      this.maxChunks = 250;

      this.captureContext = null;
      this.captureStream = null;
      this.source = null;
      this.processor = null;
      this.silentGain = null;

      this.isCapturing = false;
      this.captureError = "";
      this.chunks = [];
      this.samples = new Int16Array(this.samplesPerChunk);
      this.offset = 0;

      this.playContext = null;
      this.isPlaying = false;
      this.playError = "";
    }

    get samplesPerChunk() {
      return Math.round(this.sampleRate * this.chunkMs / 1000);
    }

    getInfo() {
      return {
        id: "liveAudioStream",
        name: "Live Audio",
        color1: "#1677c8",
        color2: "#105b9b",
        color3: "#0b4274",
        blocks: [
          {
            opcode: "settings",
            blockType: Scratch.BlockType.COMMAND,
            text: "set audio settings sample rate [RATE] chunk length [MS] ms",
            arguments: {
              RATE: {
                type: Scratch.ArgumentType.NUMBER,
                menu: "rates",
                defaultValue: 16000
              },
              MS: {
                type: Scratch.ArgumentType.NUMBER,
                menu: "durations",
                defaultValue: 40
              }
            }
          },
          {
            opcode: "start",
            blockType: Scratch.BlockType.COMMAND,
            text: "start microphone capture"
          },
          {
            opcode: "stop",
            blockType: Scratch.BlockType.COMMAND,
            text: "stop microphone capture"
          },
          {
            opcode: "running",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "microphone capturing?"
          },
          {
            opcode: "available",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "audio chunk available?"
          },
          {
            opcode: "next",
            blockType: Scratch.BlockType.REPORTER,
            text: "next audio chunk (Base64 PCM)"
          },
          {
            opcode: "play",
            blockType: Scratch.BlockType.COMMAND,
            text: "play audio chunk [DATA] and wait",
            arguments: {
              DATA: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: ""
              }
            }
          }
        ],
        menus: {
          rates: {
            acceptReporters: false,
            items: [
              { text: "8000 Hz", value: "8000" },
              { text: "16000 Hz", value: "16000" },
              { text: "22050 Hz", value: "22050" },
              { text: "32000 Hz", value: "32000" },
              { text: "44100 Hz", value: "44100" },
              { text: "48000 Hz", value: "48000" }
            ]
          },
          durations: {
            acceptReporters: false,
            items: [
              { text: "20", value: "20" },
              { text: "40", value: "40" },
              { text: "60", value: "60" },
              { text: "100", value: "100" },
              { text: "200", value: "200" }
            ]
          }
        }
      };
    }

    settings(args) {
      if (this.isCapturing) {
        this.captureError = "Stop capture before changing audio settings.";
        return;
      }

      const rate = Number(args.RATE);
      const duration = Number(args.MS);

      const allowedRates = [8000, 16000, 22050, 32000, 44100, 48000];
      const allowedDurations = [20, 40, 60, 100, 200];

      if (allowedRates.includes(rate)) this.sampleRate = rate;
      if (allowedDurations.includes(duration)) this.chunkMs = duration;

      this.samples = new Int16Array(this.samplesPerChunk);
      this.offset = 0;
      this.captureError = "";
    }

    async start() {
      if (this.isCapturing) return;

      this.captureError = "";
      this.chunks.length = 0;
      this.samples = new Int16Array(this.samplesPerChunk);
      this.offset = 0;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone access requires HTTPS.");
        }

        this.captureStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        this.captureContext = new AudioContextClass();
        await this.captureContext.resume();

        this.source =
          this.captureContext.createMediaStreamSource(this.captureStream);

        this.processor =
          this.captureContext.createScriptProcessor(2048, 1, 1);

        this.processor.onaudioprocess = event => {
          if (!this.isCapturing) return;

          this.collect(
            event.inputBuffer.getChannelData(0),
            this.captureContext.sampleRate
          );
        };

        this.silentGain = this.captureContext.createGain();
        this.silentGain.gain.value = 0;

        this.source.connect(this.processor);
        this.processor.connect(this.silentGain);
        this.silentGain.connect(this.captureContext.destination);

        this.isCapturing = true;
      } catch (error) {
        this.captureError = error.message || String(error);
        await this.releaseCapture();
      }
    }

    collect(input, inputRate) {
      // Resample the incoming audio to the configured sample rate.
      const count = Math.floor(input.length * this.sampleRate / inputRate);

      for (let i = 0; i < count; i++) {
        const position = i * inputRate / this.sampleRate;
        const left = Math.min(input.length - 1, Math.floor(position));
        const right = Math.min(input.length - 1, left + 1);
        const fraction = position - left;

        const value = input[left] +
          (input[right] - input[left]) * fraction;

        const clipped = Math.max(-1, Math.min(1, value));

        this.samples[this.offset++] = Math.round(
          clipped < 0 ? clipped * 32768 : clipped * 32767
        );

        if (this.offset >= this.samplesPerChunk) {
          this.chunks.push(this.encode(this.samples));

          if (this.chunks.length > this.maxChunks) {
            this.chunks.shift();
          }

          this.samples = new Int16Array(this.samplesPerChunk);
          this.offset = 0;
        }
      }
    }

    encode(samples) {
      const bytes = new Uint8Array(samples.length * 2);
      const view = new DataView(bytes.buffer);

      for (let i = 0; i < samples.length; i++) {
        view.setInt16(i * 2, samples[i], true);
      }

      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(
          ...bytes.subarray(i, Math.min(i + 8192, bytes.length))
        );
      }

      return btoa(binary);
    }

    decode(encoded) {
      const binary = atob(encoded);
      if (binary.length % 2 !== 0) {
        throw new Error("Invalid PCM16 data.");
      }

      const buffer = this.playContext.createBuffer(
        1,
        binary.length / 2,
        this.sampleRate
      );

      const channel = buffer.getChannelData(0);

      for (let i = 0; i < channel.length; i++) {
        let value =
          (binary.charCodeAt(i * 2) & 255) |
          ((binary.charCodeAt(i * 2 + 1) & 255) << 8);

        if (value > 32767) value -= 65536;

        channel[i] = value / (value < 0 ? 32768 : 32767);
      }

      return buffer;
    }

    stop() {
      return this.releaseCapture();
    }

    async releaseCapture() {
      this.isCapturing = false;

      if (this.processor) {
        this.processor.onaudioprocess = null;
        try { this.processor.disconnect(); } catch (_) {}
        this.processor = null;
      }

      if (this.source) {
        try { this.source.disconnect(); } catch (_) {}
        this.source = null;
      }

      if (this.silentGain) {
        try { this.silentGain.disconnect(); } catch (_) {}
        this.silentGain = null;
      }

      if (this.captureStream) {
        this.captureStream.getTracks().forEach(track => track.stop());
        this.captureStream = null;
      }

      if (this.captureContext) {
        try { await this.captureContext.close(); } catch (_) {}
        this.captureContext = null;
      }

      this.samples = new Int16Array(this.samplesPerChunk);
      this.offset = 0;
    }

    running() {
      return this.isCapturing;
    }

    available() {
      return this.chunks.length > 0;
    }

    next() {
      return this.chunks.length ? this.chunks.shift() : "";
    }

    async play(args) {
      const encoded = String(args.DATA || "").trim();
      if (!encoded) return;

      // Avoid overlapping calls from scripts.
      while (this.isPlaying) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      this.isPlaying = true;
      this.playError = "";

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!this.playContext || this.playContext.state === "closed") {
          this.playContext = new AudioContextClass();
        }

        if (this.playContext.state !== "running") {
          await this.playContext.resume();
        }

        const audioBuffer = this.decode(encoded);
        const source = this.playContext.createBufferSource();

        source.buffer = audioBuffer;
        source.connect(this.playContext.destination);

        await new Promise((resolve, reject) => {
          source.onended = resolve;

          try {
            source.start();
          } catch (error) {
            reject(error);
          }
        });

        try { source.disconnect(); } catch (_) {}
      } catch (error) {
        this.playError = error.message || String(error);
      } finally {
        this.isPlaying = false;
      }
    }
  }

  Scratch.extensions.register(new LiveAudioStream());
})(Scratch);
