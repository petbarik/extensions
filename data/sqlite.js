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
            this.hasError = false;
            
            this.init();
        }

        async init() {
            try {
                await new Promise((res, rej) => {
                    if (window.initSqlJs) return res();
                    const s = document.createElement("script");
                    s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
                    s.onload = res;
                    s.onerror = rej;
                    document.head.appendChild(s);
                });

                this.SQL = await window.initSqlJs({
                    locateFile: file => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm"
                });

                this.db = new this.SQL.Database();
                this.isReady = true;
                console.log("sqlite loaded");
            } catch (err) {
                console.error("failed to start sqlite:", err);
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
            return this.hasError;
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
                const base64 = args.URI.split(',')[1];
                const bStr = atob(base64);
                const bytes = new Uint8Array(bStr.length);
                for (let i = 0; i < bStr.length; i++) {
                    bytes[i] = bStr.charCodeAt(i);
                }
                this.db = new this.SQL.Database(bytes);
                this.lastResult = null;
                this.hasError = false;
            } catch (err) {
                this.hasError = true;
                console.error("load failed:", err);
            }
        }

        runCommand(args) {
            if (!this.isReady || !this.db) return;
            try {
                this.lastResult = this.db.exec(args.CMD);
                this.hasError = false; 
            } catch (err) {
                this.hasError = true;
                this.lastResult = [{ error: err.message }];
                console.error("sql error:", err.message);
            }
        }

        returnResult() {
            if (!this.lastResult || this.lastResult.length === 0) return "";
            if (this.lastResult[0].error) return "ERROR: " + this.lastResult[0].error;
            return JSON.stringify(this.lastResult[0].values);
        }

        clearDatabase() {
            if (!this.isReady || !this.SQL) return;
            this.db = new this.SQL.Database();
            this.lastResult = null;
            this.hasError = false;
        }
    }

    Scratch.extensions.register(new SQLiteExt());
})(Scratch);
