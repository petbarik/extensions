(function(Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('This extension must be run unsandboxed');
    }

    class SQLiteExt {
        constructor() {
            this.SQL = null;
            this.db = null;
            this.lastResult = null;
            this.isReady = false;
            this.errorState = false; // Fixed: Renamed from hasError to avoid method collision
            
            this.init();
        }

        async init() {
            try {
                await new Promise((res, rej) => {
                    if (window.initSqlJs) return res();
                    const s = document.createElement("script");
                    // Fixed: Added correct CDN path to the sql-wasm library
                    s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";
                    s.onload = res;
                    s.onerror = rej;
                    document.head.appendChild(s);
                });

                // Fixed: Pointed locateFile to download the WebAssembly binary from the CDN
                this.SQL = await window.initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });

                this.db = new this.SQL.Database();
                this.isReady = true;
                console.log("SQLite successfully loaded");
            } catch (err) {
                console.error("Failed to start sqlite:", err);
                this.errorState = true;
            }
        }

        getInfo() {
            return {
                id: 'sqliteextension',
                name: 'SQLite',
                color1: '#2c3e50',
                color2: '#34495e',
                blocks: [
                    {
                        opcode: 'isEngineReady',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'is database ready?'
                    },
                    {
                        opcode: 'hasError',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'error?'
                    },
                    {
                        opcode: 'saveDatabase',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'get database as data:uri'
                    },
                    {
                        opcode: 'loadDatabase',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'load database from data:uri [URI]',
                        arguments: {
                            URI: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ''
                            }
                        }
                    },
                    {
                        opcode: 'runCommand',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'run SQL [CMD]',
                        arguments: {
                            CMD: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ''
                            }
                        }
                    },
                    {
                        opcode: 'returnResult',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'get last SQL return'
                    },
                    {
                        opcode: 'clearDatabase',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'clear database'
                    }
                ]
            };
        }

        isEngineReady() {
            return this.isReady;
        }

        hasError() {
            return this.errorState;
        }

        saveDatabase() {
            if (!this.isReady || !this.db) return "ERROR: NOT_READY";
            try {
                const u8 = this.db.export();
                let bStr = "";
                const chunk = 8192;
                for (let i = 0; i < u8.length; i += chunk) {
                    bStr += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
                }
                return "data:application/octet-stream;base64," + btoa(bStr);
            } catch (e) {
                return "ERROR: " + e.message;
            }
        }

        loadDatabase(args) {
            if (!this.isReady || !this.SQL || !args.URI) return;
            try {
                const parts = args.URI.split(',');
                const base64 = parts.length > 1 ? parts[1] : parts[0];
                
                const bStr = atob(base64);
                const bytes = new Uint8Array(bStr.length);
                for (let i = 0; i < bStr.length; i++) {
                    bytes[i] = bStr.charCodeAt(i);
                }
                
                const testDb = new this.SQL.Database(bytes);
                testDb.exec("PRAGMA integrity_check;");
                
                this.db = testDb;
                this.lastResult = null;
                this.errorState = false;
            } catch (err) {
                this.errorState = true;
                this.lastResult = [{ error: "Invalid database: " + err.message }];
                console.error("Load failed:", err);
            }
        }

        runCommand(args) {
            if (!this.isReady || !this.db) return;
            try {
                this.lastResult = this.db.exec(args.CMD);
                this.errorState = false; 
            } catch (err) {
                this.errorState = true;
                this.lastResult = [{ error: err.message }];
                console.error("SQL error:", err.message);
            }
        }

        returnResult() {
            if (!this.lastResult || this.lastResult.length === 0) return "";
            
            const firstResult = this.lastResult[0];
            if (!firstResult) return "";
            if (firstResult.error) return "ERROR: " + firstResult.error;
            if (!firstResult.values) return "";
            
            return JSON.stringify(firstResult.values);
        }

        clearDatabase() {
            if (!this.isReady || !this.SQL) return;
            this.db = new this.SQL.Database();
            this.lastResult = null;
            this.errorState = false;
        }
    }

    Scratch.extensions.register(new SQLiteExt());
})(Scratch);
