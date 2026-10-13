/* Live Audio Stream for PenguinMod
 * Real-time microphone capture and PCM16 audio playback.
 * Format: 16 kHz, mono, signed 16-bit PCM, little-endian.
 * Requires an unsandboxed custom extension on HTTPS.
 */
(function (Scratch) {
  "use strict";

  if (!Scratch || !Scratch.extensions || !Scratch.extensions.unsandboxed) {
    throw new Error("Live Audio Stream requires an unsandboxed extension.");
  }

  const TARGET_RATE = 16000;
  const CHUNK_MS = 40;
  const SAMPLES_PER_CHUNK = TARGET_RATE * CHUNK_MS / 1000;
  const MAX_CAPTURE_CHUNKS = 200;
  const MAX_PLAYBACK_QUEUE_SECONDS = 10;

  class LiveAudioStream {
    constructor() {
      this.captureContext = null;
      this.captureStream = null;
      this.sourceNode = null;
      this.processorNode = null;
      this.silentGain = null;
      this.captureChunks = [];
      this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
      this.captureOffset = 0;
      this.isCapturing = false;
      this.captureError = "";

      this.playbackContext = null;
      this.playbackNextTime = 0;
      this.playbackSources = new Set();
      this.playbackError = "";
    }

    getInfo() {
      return {
        id: "liveAudioStream",
        name: "Live Audio Stream",
        color1: "#1677c8",
        color2: "#105b9b",
        color3: "#0b4274",
        blocks: [
          {
            opcode: "startCapture",
            blockType: Scratch.BlockType.COMMAND,
            text: "start microphone capture"
          },
          {
            opcode: "stopCapture",
            blockType: Scratch.BlockType.COMMAND,
            text: "stop microphone capture"
          },
          {
            opcode: "captureRunning",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "microphone capture running?"
          },
          {
            opcode: "captureStatus",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio capture status"
          },
          {
            opcode: "hasChunk",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "audio chunk available?"
          },
          {
            opcode: "nextChunk",
            blockType: Scratch.BlockType.REPORTER,
            text: "next audio chunk (Base64 PCM)"
          },
          {
            opcode: "clearCaptureChunks",
            blockType: Scratch.BlockType.COMMAND,
            text: "clear pending audio chunks"
          },
          "---",
          {
            opcode: "playChunk",
            blockType: Scratch.BlockType.COMMAND,
            text: "play audio chunk (Base64 PCM) [DATA]",
            arguments: {
              DATA: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: ""
              }
            }
          },
          {
            opcode: "playbackFinished",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "audio finished playing?"
          },
          {
            opcode: "waitForPlayback",
            blockType: Scratch.BlockType.COMMAND,
            text: "wait until audio finishes playing"
          },
          {
            opcode: "clearPlayback",
            blockType: Scratch.BlockType.COMMAND,
            text: "clear playback queue"
          },
          {
            opcode: "playbackStatus",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio playback status"
          },
          {
            opcode: "playbackQueuedMs",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio playback queued (ms)"
          }
        ]
      };
    }

    async startCapture() {
      if (this.isCapturing) return;

      this.captureError = "";

      try {
        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access requires HTTPS.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          },
          video: false
        });

        this.captureStream = stream;

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        this.captureContext = new AudioContextClass();
        await this.captureContext.resume();

        this.sourceNode =
          this.captureContext.createMediaStreamSource(stream);

        this.processorNode =
          this.captureContext.createScriptProcessor(2048, 1, 1);

        this.processorNode.onaudioprocess = event => {
          if (!this.isCapturing) return;

          this._resampleAndCollect(
            event.inputBuffer.getChannelData(0),
            this.captureContext.sampleRate
          );
        };

        this.silentGain = this.captureContext.createGain();
        this.silentGain.gain.value = 0;

        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.silentGain);
        this.silentGain.connect(this.captureContext.destination);

        this.isCapturing = true;
      } catch (error) {
        this.captureError = error.message || String(error);
        await this._releaseCapture();
      }
    }

    _resampleAndCollect(input, inputRate) {
      const outputCount = Math.floor(
        input.length * TARGET_RATE / inputRate
      );

      for (let i = 0; i < outputCount; i++) {
        const position = i * inputRate / TARGET_RATE;
        const left = Math.min(
          input.length - 1,
          Math.floor(position)
        );
        const right = Math.min(input.length - 1, left + 1);
        const fraction = position - left;

        const sample =
          input[left] +
          (input[right] - input[left]) * fraction;

        const clipped = Math.max(-1, Math.min(1, sample));

        this.captureSamples[this.captureOffset++] =
          Math.round(clipped < 0
            ? clipped * 32768
            : clipped * 32767);

        if (this.captureOffset === SAMPLES_PER_CHUNK) {
          this.captureChunks.push(
            this._int16ToBase64(this.captureSamples)
          );

          if (this.captureChunks.length > MAX_CAPTURE_CHUNKS) {
            this.captureChunks.shift();
          }

          this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
          this.captureOffset = 0;
        }
      }
    }

    _int16ToBase64(samples) {
      const bytes = new Uint8Array(samples.length * 2);
      const view = new DataView(bytes.buffer);

      for (let i = 0; i < samples.length; i++) {
        view.setInt16(i * 2, samples[i], true);
      }

      let binary = "";
      const step = 0x8000;

      for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, Math.min(i + step, bytes.length))
        );
      }

      return btoa(binary);
    }

    nextChunk() {
      return this.captureChunks.length
        ? this.captureChunks.shift()
        : "";
    }

    hasChunk() {
      return this.captureChunks.length > 0;
    }

    clearCaptureChunks() {
      this.captureChunks.length = 0;
    }

    captureRunning() {
      return this.isCapturing;
    }

    captureStatus() {
      if (this.captureError) {
        return "error: " + this.captureError;
      }

      return this.isCapturing
        ? "capturing 16 kHz mono PCM16, 40 ms chunks"
        : "stopped";
    }

    async stopCapture() {
      await this._releaseCapture();

      this.captureChunks.length = 0;
      this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
      this.captureOffset = 0;
    }

    async _releaseCapture() {
      this.isCapturing = false;

      if (this.processorNode) {
        this.processorNode.onaudioprocess = null;
        try { this.processorNode.disconnect(); } catch (_) {}
        this.processorNode = null;
      }

      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (_) {}
        this.sourceNode = null;
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
    }

    async _ensurePlaybackContext() {
      if (!this.playbackContext ||
          this.playbackContext.state === "closed") {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        this.playbackContext = new AudioContextClass();
        this.playbackNextTime =
          this.playbackContext.currentTime + 0.05;
      }

      if (this.playbackContext.state !== "running") {
        await this.playbackContext.resume();
      }
    }

    async playChunk(args) {
      const encoded = String(args.DATA || "").trim();
      if (!encoded) return;

      try {
        await this._ensurePlaybackContext();

        const binary = atob(encoded);

        if (binary.length % 2 !== 0) {
          throw new Error("Invalid PCM16 chunk length.");
        }

        const sampleCount = binary.length / 2;
        const duration = sampleCount / TARGET_RATE;

        const now = this.playbackContext.currentTime;

        if (this.playbackNextTime - now >
            MAX_PLAYBACK_QUEUE_SECONDS) {
          this.playbackError =
            "Playback queue full; wait for audio to finish.";
          return;
        }

        const audioBuffer =
          this.playbackContext.createBuffer(
            1,
            sampleCount,
            TARGET_RATE
          );

        const channel = audioBuffer.getChannelData(0);

        for (let i = 0; i < sampleCount; i++) {
          let value =
            (binary.charCodeAt(i * 2) & 255) |
            ((binary.charCodeAt(i * 2 + 1) & 255) << 8);

          if (value > 32767) value -= 65536;

          channel[i] = value / (value < 0 ? 32768 : 32767);
        }

        const source =
          this.playbackContext.createBufferSource();

        source.buffer = audioBuffer;
        source.connect(this.playbackContext.destination);

        const currentTime = this.playbackContext.currentTime;

        // Do not restart the timeline for every chunk.
        // This preserves each chunk's exact duration.
        if (this.playbackNextTime < currentTime) {
          this.playbackNextTime = currentTime + 0.01;
        }

        const startAt = this.playbackNextTime;
        this.playbackNextTime = startAt + duration;

        this.playbackSources.add(source);

        source.onended = () => {
          this.playbackSources.delete(source);
          try { source.disconnect(); } catch (_) {}
        };

        source.start(startAt);
        this.playbackError = "";
      } catch (error) {
        this.playbackError = error.message || String(error);
      }
    }

    playbackFinished() {
      if (!this.playbackContext) return true;

      return (
        this.playbackSources.size === 0 &&
        this.playbackContext.currentTime >= this.playbackNextTime
      );
    }

    async waitForPlayback() {
      while (!this.playbackFinished()) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    async clearPlayback() {
      for (const source of this.playbackSources) {
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
      }

      this.playbackSources.clear();

      if (this.playbackContext &&
          this.playbackContext.state !== "closed") {
        this.playbackNextTime =
          this.playbackContext.currentTime;
      }

      this.playbackError = "";
    }

    playbackStatus() {
      if (this.playbackError) {
        return "warning: " + this.playbackError;
      }

      if (!this.playbackContext) return "not started";

      return this.playbackFinished()
        ? "finished"
        : "playing / queued";
    }

    playbackQueuedMs() {
      if (!this.playbackContext) return 0;

      return Math.round(
        Math.max(
          0,
          this.playbackNextTime -
            this.playbackContext.currentTime
        ) * 1000
      );
    }
  }

  Scratch.extensions.register(new LiveAudioStream());
})(Scratch);
