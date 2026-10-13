
(function (Scratch) {
    'use strict';

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    class LiveAudio {
        constructor() {
            this.sampleRate = 16000;
            this.chunkMs = 40;

            this.captureContext = null;
            this.playbackContext = null;
            this.stream = null;
            this.processor = null;
            this.silentGain = null;

            this.capturing = false;
            this.pendingChunks = [];
            this.recordBuffer = [];

            this.playbackSources = new Set();
            this.lastError = '';
        }

        getInfo() {
            return {
                id: 'petbarikLiveAudio',
                name: 'Live Audio',
                color1: '#5368d8',
                color2: '#4052b5',
                color3: '#30408e',
                blocks: [
                    {
                        opcode: 'settings',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'audio settings sample rate [RATE] chunk length [LENGTH] ms',
                        arguments: {
                            RATE: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'rates',
                                defaultValue: '16000'
                            },
                            LENGTH: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'lengths',
                                defaultValue: '40'
                            }
                        }
                    },
                    {
                        opcode: 'startCapture',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'start microphone recording'
                    },
                    {
                        opcode: 'stopCapture',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'stop microphone recording'
                    },
                    {
                        opcode: 'isCapturing',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'microphone recording?'
                    },
                    {
                        opcode: 'hasChunk',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'recorded audio chunk available?'
                    },
                    {
                        opcode: 'nextChunk',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'get next recorded audio chunk (Base64)'
                    },
                    {
                        opcode: 'playSingle',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'start playing audio chunk [DATA]',
                        arguments: {
                            DATA: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ''
                            }
                        }
                    },
                    {
                        opcode: 'stopPlayback',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'stop all audio playback'
                    },
                    {
                        opcode: 'status',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'audio status'
                    }
                ],
                menus: {
                    rates: {
                        acceptReporters: false,
                        items: [
                            { text: '8000 Hz', value: '8000' },
                            { text: '16000 Hz', value: '16000' },
                            { text: '22050 Hz', value: '22050' },
                            { text: '44100 Hz', value: '44100' },
                            { text: '48000 Hz', value: '48000' }
                        ]
                    },
                    lengths: {
                        acceptReporters: false,
                        items: [
                            { text: '20', value: '20' },
                            { text: '40', value: '40' },
                            { text: '60', value: '60' },
                            { text: '100', value: '100' },
                            { text: '200', value: '200' }
                        ]
                    }
                }
            };
        }

        settings(args) {
            const rate = Number(args.RATE);
            const length = Number(args.LENGTH);

            if (Number.isFinite(rate) && rate > 0) {
                this.sampleRate = rate;
            }

            if (Number.isFinite(length) && length > 0) {
                this.chunkMs = length;
            }
        }

        async startCapture() {
            if (this.capturing) return;

            try {
                this.lastError = '';

                if (!navigator.mediaDevices ||
                    !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Microphone access is not supported here.');
                }

                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });

                this.captureContext = new AudioContextClass();
                await this.captureContext.resume();

                const source =
                    this.captureContext.createMediaStreamSource(this.stream);

                this.processor =
                    this.captureContext.createScriptProcessor(4096, 1, 1);

                this.silentGain = this.captureContext.createGain();
                this.silentGain.gain.value = 0;

                this.recordBuffer = [];
                this.pendingChunks = [];
                this.capturing = true;

                this.processor.onaudioprocess = (event) => {
                    if (!this.capturing) return;

                    const input = event.inputBuffer.getChannelData(0);
                    const inputRate = this.captureContext.sampleRate;
                    const outputRate = this.sampleRate;

                    // Resample the microphone audio to the selected rate.
                    const ratio = inputRate / outputRate;
                    const outputLength = Math.floor(input.length / ratio);

                    for (let i = 0; i < outputLength; i++) {
                        const position = i * ratio;
                        const left = Math.floor(position);
                        const right = Math.min(left + 1, input.length - 1);
                        const fraction = position - left;

                        const sample =
                            input[left] * (1 - fraction) +
                            input[right] * fraction;

                        this.recordBuffer.push(
                            Math.max(-1, Math.min(1, sample))
                        );
                    }

                    const samplesPerChunk = Math.max(
                        1,
                        Math.floor(outputRate * this.chunkMs / 1000)
                    );

                    while (this.recordBuffer.length >= samplesPerChunk) {
                        const chunk =
                            this.recordBuffer.splice(0, samplesPerChunk);

                        this.pendingChunks.push(
                            this.samplesToBase64(chunk)
                        );
                    }
                };

                source.connect(this.processor);
                this.processor.connect(this.silentGain);
                this.silentGain.connect(this.captureContext.destination);
            } catch (error) {
                this.lastError = String(error.message || error);
                this.capturing = false;

                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }
            }
        }

        stopCapture() {
            this.capturing = false;

            if (this.processor) {
                this.processor.onaudioprocess = null;
                this.processor.disconnect();
                this.processor = null;
            }

            if (this.silentGain) {
                this.silentGain.disconnect();
                this.silentGain = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            if (this.captureContext) {
                this.captureContext.close().catch(() => {});
                this.captureContext = null;
            }

            this.recordBuffer = [];
        }

        isCapturing() {
            return this.capturing;
        }

        hasChunk() {
            return this.pendingChunks.length > 0;
        }

        nextChunk() {
            return this.pendingChunks.shift() || '';
        }

        samplesToBase64(samples) {
            const bytes = new Uint8Array(samples.length * 2);
            const view = new DataView(bytes.buffer);

            for (let i = 0; i < samples.length; i++) {
                const sample = Math.max(-1, Math.min(1, samples[i]));
                const pcm = sample < 0
                    ? Math.round(sample * 32768)
                    : Math.round(sample * 32767);

                view.setInt16(i * 2, pcm, true);
            }

            let binary = '';
            const step = 0x8000;

            for (let i = 0; i < bytes.length; i += step) {
                binary += String.fromCharCode(
                    ...bytes.subarray(i, Math.min(i + step, bytes.length))
                );
            }

            return btoa(binary);
        }

        base64ToSamples(base64) {
            const binary = atob(String(base64).trim());
            const byteLength = binary.length - (binary.length % 2);

            if (byteLength === 0) return new Float32Array(0);

            const bytes = new Uint8Array(byteLength);

            for (let i = 0; i < byteLength; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const view = new DataView(bytes.buffer);
            const samples = new Float32Array(byteLength / 2);

            for (let i = 0; i < samples.length; i++) {
                const pcm = view.getInt16(i * 2, true);
                samples[i] = pcm < 0 ? pcm / 32768 : pcm / 32767;
            }

            return samples;
        }

        
playSingle(args) {
    try {
        const base64 = String(args.DATA || '');
        if (!base64) return;

        // Reuse the AudioContext instead of creating one for every chunk.
        if (!this.playbackContext ||
            this.playbackContext.state === 'closed') {
            this.playbackContext = new AudioContextClass({
                sampleRate: this.sampleRate
            });
        }

        const context = this.playbackContext;

        // Start resuming without awaiting it.
        if (context.state === 'suspended') {
            context.resume().catch(error => {
                this.lastError = String(error.message || error);
            });
        }

        const samples = this.base64ToSamples(base64);
        if (!samples.length) return;

        const buffer = context.createBuffer(
            1,
            samples.length,
            this.sampleRate
        );

        buffer.copyToChannel(samples, 0);

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);

        this.playbackSources.add(source);

        source.onended = () => {
            this.playbackSources.delete(source);
            source.disconnect();
        };

        // Start immediately; do not wait for playback to finish.
        source.start(0);
    } catch (error) {
        this.lastError = String(error.message || error);
    }
}


        stopPlayback() {
            for (const source of this.playbackSources) {
                try {
                    source.stop();
                    source.disconnect();
                } catch (_) {}
            }

            this.playbackSources.clear();
        }

        status() {
            if (this.lastError) return 'Error: ' + this.lastError;
            if (this.capturing) return 'Recording';
            return 'Ready';
        }
    }

    Scratch.extensions.register(new LiveAudio());
})(Scratch);
