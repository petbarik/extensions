(function(Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        alert("This extension requires TurboWarp/PenguinMod to run unsandboxed to perform web requests!");
    }

    // ==========================================
    // 1. THE SEPARATE GLOBAL FUNCTION
    // ==========================================
    // This handles all the heavy lifting and network configurations.
    // It can be called from anywhere inside the extension.
    const _sendHttpRequest = function(method, url, bodyData) {
        const uppercaseMethod = method.toUpperCase();
        const options = {
            method: uppercaseMethod,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // GET and HEAD requests cannot send body data in JavaScript
        if (uppercaseMethod !== 'GET' && uppercaseMethod !== 'HEAD' && bodyData) {
            options.body = bodyData;
        }

        return fetch(url, options)
            .then(response => {
                if (!response.ok) {
                    return `Error: Status ${response.status}`;
                }
                return response.text(); // Always returns the raw text/JSON string
            })
            .catch(err => {
                console.error("Network request failed:", err);
                return `Network Error: ${err.message}`;
            });
    };


    // ==========================================
    // 2. THE SCRATCH EXTENSION CLASS
    // ==========================================
    class YoutubeAPIReloaded {
        getInfo() {
            return {
                id: 'youtubeapireloaded',
                name: 'YoutubeAPI reloaded',
                color1: '#FF4B4B', // Sleek UI Red
                color2: '#D33232',
                blocks: [
                    // Example Block that uses the global function
                    {
                        opcode: 'searchSwedenYT',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'Search Sweden for YouTube videos matching [QUERY]',
                        arguments: {
                            QUERY: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: 'musik'
                            }
                        }
                    }
                ]
            };
        }

        // ==========================================
        // 3. BLOCK IMPLEMENTATION
        // ==========================================
        // This block simply passes information to our global function
        searchSwedenYT(args) {
            const query = encodeURIComponent(args.QUERY);
            
            // Define the parameters for our global function
            const method = 'GET';
            const targetUrl = `https://yewtu.be/api/v1/search?q=${query}&region=SE&type=video`;
            const body = null;

            // We call the global function here and return its output directly to the Scratch block
            return _sendHttpRequest(method, targetUrl, body);
        }
    }

    Scratch.extensions.register(new YoutubeAPIReloaded());
})(Scratch);
