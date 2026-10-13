/* Live Audio Stream for PenguinMod
 * Captures microphone audio as mono signed 16-bit PCM, resampled to 16 kHz.
 * Exposes Base64 PCM chunks for transport by the project's existing CloudLink blocks.
 *
 * Load as an UNSANDBOXED custom extension on an HTTPS page.
 * Browser microphone permission must be granted by the user.
 */
(function (Scratch) {
  "use strict";

  if (!Scratch || !Scratch.extensions || !Scratch.extensions.unsandboxed) {
    throw new Error("Live Audio Stream requires an unsandboxed custom extension.");
  }

  const TARGET_RATE = 16000;
  const CHUNK_MS = 40;
  const SAMPLES_PER_CHUNK = TARGET_RATE * CHUNK_MS / 1000; // 640 samples
  const MAX_CAPTURE_CHUNKS = 100; // 4 seconds; oldest chunks are dropped if not polled.
  const MAX_PLAYBACK_QUEUE_SECONDS = 5;

  class LiveAudioStream {
    constructor() {
      this.captureContext = null;
      this.captureStream = null;
      this.sourceNode = null;
      this.processorNode = null;
      this.captureChunks = [];
      this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
      this.captureOffset = 0;
      this.captureRunning = false;
      this.captureError = "";

      this.playbackContext = null;
      this.playbackNextTime = 0;
      this.playbackScheduledSeconds = 0;
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
            text: "start microphone capture",
          },
          {
            opcode: "stopCapture",
            blockType: Scratch.BlockType.COMMAND,
            text: "stop microphone capture",
          },
          {
            opcode: "captureRunning",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "microphone capture running?",
          },
          {
            opcode: "captureStatus",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio capture status",
          },
          {
            opcode: "hasChunk",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "audio chunk available?",
          },
          {
            opcode: "nextChunk",
            blockType: Scratch.BlockType.REPORTER,
            text: "next audio chunk (Base64 PCM)",
          },
          {
            opcode: "clearCaptureChunks",
            blockType: Scratch.BlockType.COMMAND,
            text: "clear pending audio chunks",
          },
          "---",
          {
            opcode: "playChunk",
            blockType: Scratch.BlockType.COMMAND,
            text: "play audio chunk (Base64 PCM) [DATA]",
            arguments: {
              DATA: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "",
              },
            },
          },
          {
            opcode: "clearPlayback",
            blockType: Scratch.BlockType.COMMAND,
            text: "clear playback queue",
          },
          {
            opcode: "playbackStatus",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio playback status",
          },
          {
            opcode: "playbackQueuedMs",
            blockType: Scratch.BlockType.REPORTER,
            text: "audio playback queued (ms)",
          },
        ],
      };
    }

    async startCapture() {
      if (this.captureRunning) return;
      this.captureError = "";
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone capture requires HTTPS and getUserMedia support.");
        }

        this.captureStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.captureContext = new AudioContextClass();
        await this.captureContext.resume();

        this.sourceNode = this.captureContext.createMediaStreamSource(this.captureStream);

        // ScriptProcessorNode is broadly supported by custom-extension environments.
        // Its callback only converts samples and assembles small chunks; it does not encode files.
        const bufferSize = 2048;
        this.processorNode = this.captureContext.createScriptProcessor(bufferSize, 1, 1);
        this.processorNode.onaudioprocess = (event) => {
          if (!this.captureRunning) return;
          const input = event.inputBuffer.getChannelData(0);
          this._resampleAndCollect(input, this.captureContext.sampleRate);
        };

        // Keep the processor active without playing microphone audio through the speakers.
        const silentGain = this.captureContext.createGain();
        silentGain.gain.value = 0;
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(silentGain);
        silentGain.connect(this.captureContext.destination);
        this._silentGain = silentGain;

        this.captureRunning = true;
      } catch (error) {
        this.captureError = error && error.message ? error.message : String(error);
        await this._releaseCapture();
      }
    }

    _resampleAndCollect(input, inputRate) {
      // Linear resampling within each callback. Small boundary differences are generally
      // inaudible for speech at 16 kHz; no file encoding or disk saving occurs.
      const outputCount = Math.max(1, Math.floor(input.length * TARGET_RATE / inputRate));
      for (let i = 0; i < outputCount; i++) {
        const position = i * inputRate / TARGET_RATE;
        const left = Math.min(input.length - 1, Math.floor(position));
        const right = Math.min(input.length - 1, left + 1);
        const fraction = position - left;
        const sample = input[left] + (input[right] - input[left]) * fraction;
        const clipped = Math.max(-1, Math.min(1, sample));
        const intSample = clipped < 0 ? clipped * 32768 : clipped * 32767;
        this.captureSamples[this.captureOffset++] = Math.round(intSample);

        if (this.captureOffset >= SAMPLES_PER_CHUNK) {
          this.captureChunks.push(this._int16ToBase64(this.captureSamples));
          if (this.captureChunks.length > MAX_CAPTURE_CHUNKS) {
            this.captureChunks.shift();
          }
          this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
          this.captureOffset = 0;
        }
      }
    }

    _int16ToBase64(samples) {
      // Explicit little-endian PCM16.
      const bytes = new Uint8Array(samples.length * 2);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < samples.length; i++) {
        view.setInt16(i * 2, samples[i], true);
      }
      let binary = "";
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
      }
      return btoa(binary);
    }

    nextChunk() {
      return this.captureChunks.length ? this.captureChunks.shift() : "";
    }

    hasChunk() {
      return this.captureChunks.length > 0;
    }

    clearCaptureChunks() {
      this.captureChunks.length = 0;
    }

    captureRunningBlock() {
      return this.captureRunning;
    }

    captureStatus() {
      if (this.captureError) return "error: " + this.captureError;
      return this.captureRunning ? "capturing 16 kHz mono PCM16, 40 ms chunks" : "stopped";
    }

    async stopCapture() {
      await this._releaseCapture();
      this.captureRunning = false;
      this.captureChunks.length = 0;
      this.captureSamples = new Int16Array(SAMPLES_PER_CHUNK);
      this.captureOffset = 0;
    }

    async _releaseCapture() {
      this.captureRunning = false;
      if (this.processorNode) {
        this.processorNode.onaudioprocess = null;
        try { this.processorNode.disconnect(); } catch (_) {}
        this.processorNode = null;
      }
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (_) {}
        this.sourceNode = null;
      }
      if (this._silentGain) {
        try { this._silentGain.disconnect(); } catch (_) {}
        this._silentGain = null;
      }
      if (this.captureStream) {
        for (const track of this.captureStream.getTracks()) track.stop();
        this.captureStream = null;
      }
      if (this.captureContext) {
        try { await this.captureContext.close(); } catch (_) {}
        this.captureContext = null;
      }
    }

    async _ensurePlaybackContext() {
      if (!this.playbackContext || this.playbackContext.state === "closed") {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.playbackContext = new AudioContextClass();
        this.playbackNextTime = this.playbackContext.currentTime + 0.04;
        this.playbackScheduledSeconds = 0;
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
        if (this.playbackScheduledSeconds > MAX_PLAYBACK_QUEUE_SECONDS) {
          this.playbackError = "playback queue full; waiting for queued audio to drain";
          return;
        }

        const binary = atob(encoded);
        if (binary.length % 2 !== 0) throw new Error("Invalid PCM16 chunk length.");
        const sampleCount = binary.length / 2;
        const samples = new Int16Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
          const value = (binary.charCodeAt(i * 2) & 255) | ((binary.charCodeAt(i * 2 + 1) & 255) << 8);
          samples[i] = value > 32767 ? value - 65536 : value;
        }

        const audioBuffer = this.playbackContext.createBuffer(1, sampleCount, TARGET_RATE);
        const channel = audioBuffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          channel[i] = samples[i] / (samples[i] < 0 ? 32768 : 32767);
        }

        const source = this.playbackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.playbackContext.destination);

        const now = this.playbackContext.currentTime;
        if (this.playbackNextTime < now + 0.015) {
          this.playbackNextTime = now + 0.04;
        }
        const startAt = this.playbackNextTime;
        const duration = sampleCount / TARGET_RATE;
        this.playbackNextTime = startAt + duration;
        this.playbackScheduledSeconds = Math.max(0, this.playbackNextTime - now);

        this.playbackSources.add(source);
        source.onended = () => {
          this.playbackSources.delete(source);
          this.playbackScheduledSeconds = Math.max(0, this.playbackNextTime - this.playbackContext.currentTime);
          try { source.disconnect(); } catch (_) {}
        };
        source.start(startAt);
        this.playbackError = "";
      } catch (error) {
        this.playbackError = error && error.message ? error.message : String(error);
      }
    }

    async clearPlayback() {
      for (const source of this.playbackSources) {
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
      }
      this.playbackSources.clear();
      if (this.playbackContext && this.playbackContext.state !== "closed") {
        this.playbackNextTime = this.playbackContext.currentTime + 0.04;
      }
      this.playbackScheduledSeconds = 0;
      this.playbackError = "";
    }

    playbackStatus() {
      if (this.playbackError) return "warning: " + this.playbackError;
      return this.playbackContext ? "ready" : "not started";
    }

    playbackQueuedMs() {
      if (!this.playbackContext) return 0;
      return Math.round(Math.max(0, this.playbackNextTime - this.playbackContext.currentTime) * 1000);
    }
  }

  Scratch.extensions.register(new LiveAudioStream());
})(Scratch);
