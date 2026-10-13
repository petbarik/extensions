
(function (Scratch) {
    "use strict";

    if (!Scratch || !Scratch.extensions || !Scratch.extensions.unsandboxed) {
        throw new Error("This extension must run unsandboxed.");
    }

    const MAX_CAPTURE_CHUNKS = 500;
    const MAX_PLAYBACK_SECONDS = 60;

    class LiveAudioStream {
        constructor() {
            this.sampleRate = 16000;
            this.chunkMs = 40;

            this.captureContext = null;
            this.captureStream = null;
            this.sourceNode = null;
            this.processorNode = null;
            this.captureRunning = false;
            this.captureError = "";
            this.captureChunks = [];
            this.captureBuffer = [];
            this.captureOffset = 0;

            this.playbackContext = null;
            this.playbackChunks = [];
            this.playbackRunning = false;
            this.playbackError = "";
        }

        getInfo() {
            return {
                id: "petbarikLiveAudio",
                name: "Live Audio",
                color1: "#7054C8",
                color2: "#5940A8",
                blocks: [
                    {
                        opcode: "settings",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set audio sample rate [RATE] chunk length [MS] ms",
                        arguments: {
                            RATE: {
                                type: Scratch.ArgumentType.STRING,
                                menu: "rates",
                                defaultValue: "16000"
                            },
                            MS: {
                                type: Scratch.ArgumentType.STRING,
                                menu: "chunkLengths",
                                defaultValue: "40"
                            }
                        }
                    },
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
                        opcode: "isCapturing",
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: "microphone capturing?"
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
                        opcode: "addToBuffer",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "add audio chunk [DATA] to playback buffer",
                        arguments: {
                            DATA: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ""
                            }
                        }
                    },
                    {
                        opcode: "playBuffer",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "play playback buffer from [DIRECTION] and wait",
                        arguments: {
                            DIRECTION: {
                                type: Scratch.ArgumentType.STRING,
                                menu: "directions",
                                defaultValue: "BEGINNING"
                            }
                        }
                    },
                    {
                        opcode: "clearPlaybackBuffer",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "clear playback buffer"
                    },
                    {
                        opcode: "playSingle",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "play single audio chunk [DATA] and wait",
                        arguments: {
                            DATA: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ""
                            }
                        }
                    },
                    {
                        opcode: "bufferLength",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "playback buffer chunks"
                    },
                    {
                        opcode: "status",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "audio status"
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
                    chunkLengths: {
                        acceptReporters: false,
                        items: [
                            { text: "20", value: "20" },
                            { text: "40", value: "40" },
                            { text: "60", value: "60" },
                            { text: "100", value: "100" },
                            { text: "200", value: "200" }
                        ]
                    },
                    directions: {
                        acceptReporters: false,
                        items: [
                            { text: "beginning (FIFO)", value: "BEGINNING" },
                            { text: "end (reverse order)", value: "END" }
                        ]
                    }
                }
            };
        }

        settings(args) {
            if (this.captureRunning) {
                this.captureError = "Stop capture before changing settings.";
                return;
            }

            const rate = Number(args.RATE);
            const ms = Number(args.MS);

            if (rate > 0 && ms > 0) {
                this.sampleRate = rate;
                this.chunkMs = ms;
                this.captureError = "";
            }
        }

        async startCapture() {
            if (this.captureRunning) return;

            try {
                this.captureError = "";
                this.captureChunks = [];
                this.captureBuffer = [];
                this.captureOffset = 0;

                this.captureStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });

                this.captureContext = new AudioContext();
                await this.captureContext.resume();

                this.sourceNode =
                    this.captureContext.createMediaStreamSource(this.captureStream);

                this.processorNode =
                    this.captureContext.createScriptProcessor(4096, 1, 1);

                const silentGain = this.captureContext.createGain();
                silentGain.gain.value = 0;

                this.processorNode.onaudioprocess = event => {
                    if (!this.captureRunning) return;

                    const input = event.inputBuffer.getChannelData(0);
                    const inputRate = this.captureContext.sampleRate;
                    const outputCount = Math.floor(
                        input.length * this.sampleRate / inputRate
                    );

                    for (let i = 0; i < outputCount; i++) {
                        const position = i * inputRate / this.sampleRate;
                        const left = Math.min(Math.floor(position), input.length - 1);
                        const right = Math.min(left + 1, input.length - 1);
                        const fraction = position - left;

                        const sample =
                            input[left] * (1 - fraction) +
                            input[right] * fraction;

                        const int16 = Math.max(
                            -32768,
                            Math.min(32767, Math.round(
                                sample < 0 ? sample * 32768 : sample * 32767
                            ))
                        );

                        this.captureBuffer.push(int16);
                    }

                    const samplesPerChunk = Math.round(
                        this.sampleRate * this.chunkMs / 1000
                    );

                    while (this.captureBuffer.length >= samplesPerChunk) {
                        const samples = this.captureBuffer.splice(0, samplesPerChunk);

                        if (this.captureChunks.length >= MAX_CAPTURE_CHUNKS) {
                            this.captureChunks.shift();
                        }

                        this.captureChunks.push(this.samplesToBase64(samples));
                    }
                };

                this.sourceNode.connect(this.processorNode);
                this.processorNode.connect(silentGain);
                silentGain.connect(this.captureContext.destination);

                this.captureRunning = true;
            } catch (error) {
                this.captureError = String(error);
                this.captureRunning = false;
                this._releaseCapture();
            }
        }

        stopCapture() {
            this.captureRunning = false;
            this._releaseCapture();
        }

        _releaseCapture() {
            if (this.processorNode) {
                this.processorNode.onaudioprocess = null;
                this.processorNode.disconnect();
                this.processorNode = null;
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            if (this.captureStream) {
                this.captureStream.getTracks().forEach(track => track.stop());
                this.captureStream = null;
            }

            if (this.captureContext) {
                this.captureContext.close().catch(() => {});
                this.captureContext = null;
            }
        }

        isCapturing() {
            return this.captureRunning;
        }

        hasChunk() {
            return this.captureChunks.length > 0;
        }

        nextChunk() {
            return this.captureChunks.shift() || "";
        }

        samplesToBase64(samples) {
            const bytes = new Uint8Array(samples.length * 2);
            const view = new DataView(bytes.buffer);

            for (let i = 0; i < samples.length; i++) {
                view.setInt16(i * 2, samples[i], true);
            }

            let binary = "";
            const stride = 8192;

            for (let i = 0; i < bytes.length; i += stride) {
                binary += String.fromCharCode(
                    ...bytes.subarray(i, Math.min(i + stride, bytes.length))
                );
            }

            return btoa(binary);
        }

        base64ToSamples(data) {
            const binary = atob(String(data).trim());
            const length = binary.length - (binary.length % 2);
            const samples = new Int16Array(length / 2);

            for (let i = 0; i < samples.length; i++) {
                let value = binary.charCodeAt(i * 2) |
                    (binary.charCodeAt(i * 2 + 1) << 8);

                if (value >= 32768) value -= 65536;
                samples[i] = value;
            }

            return samples;
        }

        addToBuffer(args) {
            try {
                const data = String(args.DATA || "").trim();
                if (!data) return;

                const samples = this.base64ToSamples(data);
                if (samples.length === 0) return;

                const currentSamples = this.playbackChunks.reduce(
                    (total, chunk) => total + chunk.length, 0
                );

                const maxSamples = this.sampleRate * MAX_PLAYBACK_SECONDS;

                if (currentSamples + samples.length > maxSamples) {
                    this.playbackError = "Playback buffer limit reached.";
                    return;
                }

                this.playbackChunks.push(samples);
                this.playbackError = "";
            } catch (error) {
                this.playbackError = "Invalid Base64 PCM chunk: " + String(error);
            }
        }

        clearPlaybackBuffer() {
            this.playbackChunks = [];
            this.playbackError = "";
        }

        bufferLength() {
            return this.playbackChunks.length;
        }

        async playBuffer(args) {
            if (this.playbackRunning) return;

            if (this.playbackChunks.length === 0) {
                this.playbackError = "Playback buffer is empty.";
                return;
            }

            let chunks = this.playbackChunks.slice();

            if (String(args.DIRECTION) === "END") {
                chunks.reverse();
            }

            const totalSamples = chunks.reduce(
                (total, chunk) => total + chunk.length, 0
            );

            const combined = new Int16Array(totalSamples);
            let offset = 0;

            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            this.playbackChunks = [];
            await this._playSamples(combined);
        }


async playSingle(args) {
    try {
        const data = String(args.DATA || "").trim();
        if (!data) return;

        const samples = this.base64ToSamples(data);
        if (samples.length === 0) return;

        if (this.playbackRunning) return;

        this.playbackRunning = true;
        this.playbackError = "";

        if (!this.playbackContext ||
            this.playbackContext.state === "closed") {
            this.playbackContext = new AudioContext({
                sampleRate: this.sampleRate,
                latencyHint: "interactive"
            });
        }

        const context = this.playbackContext;
        await context.resume();

        const audioBuffer = context.createBuffer(
            1,
            samples.length,
            this.sampleRate
        );

        const channel = audioBuffer.getChannelData(0);

        for (let i = 0; i < samples.length; i++) {
            channel[i] = samples[i] / 32768;
        }

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);

        const startTime = Math.max(
            context.currentTime + 0.02,
            this.nextPlaybackTime || 0
        );

        this.nextPlaybackTime = startTime + audioBuffer.duration;

        await new Promise(resolve => {
            source.onended = resolve;
            source.start(startTime);
        });

        source.disconnect();

        if (context.currentTime >= this.nextPlaybackTime) {
            this.nextPlaybackTime = context.currentTime;
        }
    } catch (error) {
        this.playbackError = "Invalid audio chunk: " + String(error);
    } finally {
        this.playbackRunning = false;
    }
}


        async _playSamples(samples) {
            if (this.playbackRunning || samples.length === 0) return;

            try {
                this.playbackError = "";
                this.playbackRunning = true;

                if (!this.playbackContext ||
                    this.playbackContext.state === "closed") {
                    this.playbackContext = new AudioContext();
                }

                await this.playbackContext.resume();

                const audioBuffer = this.playbackContext.createBuffer(
                    1,
                    samples.length,
                    this.sampleRate
                );

                const channel = audioBuffer.getChannelData(0);

                for (let i = 0; i < samples.length; i++) {
                    channel[i] = samples[i] / 32768;
                }

                const source = this.playbackContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.playbackContext.destination);

                await new Promise(resolve => {
                    source.onended = resolve;
                    source.start();
                });

                source.disconnect();
            } catch (error) {
                this.playbackError = String(error);
            } finally {
                this.playbackRunning = false;
            }
        }

        status() {
            if (this.captureError) return "Capture: " + this.captureError;
            if (this.playbackError) return "Playback: " + this.playbackError;
            if (this.playbackRunning) return "Playing audio";
            if (this.captureRunning) return "Recording";
            return "Ready";
        }
    }

    Scratch.extensions.register(new LiveAudioStream());
})(Scratch);
