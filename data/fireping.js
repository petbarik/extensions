class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";

    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";

    this.failed = false;
    this.error = "";
    this.loggedIn = false;

    this.refreshInterval = null;
  }

  getInfo() {
    return {
      id: 'firePing',
      name: 'Fire Ping',
      blocks: [
        {
          opcode: 'setFireBase',
          blockType: 'command',
          text: 'set database url to [URL] and API to [API]',
          arguments: {
            URL: { type: 'string', defaultValue: 'https://yourdatabase.your_region.firebasedatabase.app/' },
            API: { type: 'string', defaultValue: 'AIza...' }
          }
        },
        {
          opcode: 'failedLast',
          blockType: 'Boolean',
          text: 'failed?',
          arguments: {}
        },
        {
          opcode: 'getError',
          blockType: 'reporter',
          text: 'error',
          arguments: {}
        },
        {
          opcode: 'isLoggedIn',
          blockType: 'Boolean',
          text: 'logged in?',
          arguments: {}
        },
        {
          opcode: 'createUser',
          blockType: 'command',
          text: 'create account with email [EMAIL] password [PASSWORD]',
          arguments: {
            EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' },
            PASSWORD: { type: 'string', defaultValue: 'Secret123' }
          }
        },
        {
          opcode: 'loginUser',
          blockType: 'command',
          text: 'login account with email [EMAIL] password [PASSWORD]',
          arguments: {
            EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' },
            PASSWORD: { type: 'string', defaultValue: 'Secret123' }
          }
        },
        {
          opcode: 'logoutUser',
          blockType: 'command',
          text: 'logout current account',
          arguments: {}
        },
        {
          opcode: 'deleteUser',
          blockType: 'command',
          text: 'delete current account',
          arguments: {}
        },
        {
          opcode: 'sendData',
          blockType: 'command',
          text: 'send data [DATA] and store it at path [PATH]',
          arguments: {
            DATA: { type: 'string', defaultValue: '{"key":"value"}' },
            PATH: { type: 'string', defaultValue: 'user' }
          }
        },
        {
          opcode: 'changeData',
          blockType: 'command',
          text: 'update data [DATA] at path [PATH]',
          arguments: {
            DATA: { type: 'string', defaultValue: '{"key":"value"}' },
            PATH: { type: 'string', defaultValue: 'user' }
          }
        },
        {
          opcode: 'getData',
          blockType: 'reporter',
          text: 'get data at path [PATH]',
          arguments: {
            PATH: { type: 'string', defaultValue: 'user' }
          }
        }
      ]
    };
  }

  /* -------------------------
     Utility helpers
     ------------------------- */

  // Normalize base DB URL (remove trailing slashes)
  _baseURL() {
    return (this.dataBaseURL || '').replace(/\/+$/, '');
  }

  // Normalize path (remove leading / and trailing .json)
  _normalizePath(path) {
    if (!path) return '';
    path = String(path).trim();
    path = path.replace(/^\/+/, ''); // remove leading slash
    path = path.replace(/\.json$/, ''); // remove .json if provided
    return path;
  }

  // Safe parse user-provided DATA (string or object)
  _parseData(input) {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        // If the user passed a plain string, store it as-is
        return input;
      }
    }
    return input;
  }

  // Generic fetch -> returns { ok, result } and doesn't throw
  _fetchJson(url, options = {}) {
    return fetch(url, options)
      .then(response =>
        response.json()
          .then(result => ({ ok: response.ok, result }))
          .catch(() => ({ ok: response.ok, result: null }))
      )
      .catch(err => ({ ok: false, result: { error: { message: String(err) } } }));
  }

  /* -------------------------
     Block implementations
     ------------------------- */

  setFireBase({ URL, API }) {
    // Keep the URL exactly as user enters, but normalize for internal requests
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() {
    return !!this.failed;
  }

  getError() {
    return this.error || "";
  }

  isLoggedIn() {
    return !!this.loggedIn;
  }

  // createUser - returns a Promise so Scratch/PenguinMod knows when it's done
  createUser({ EMAIL, PASSWORD }) {
    return new Promise(async (resolve) => {
      try {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.APIkey}`;
        const { ok, result } = await this._fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
        });

        if (!ok) throw new Error(result?.error?.message || 'Sign-up failed');

        this.idToken = result.idToken;
        this.refreshToken = result.refreshToken;
        this.localId = result.localId;

        this.loggedIn = true;
        this.failed = false;
        this.error = "";

        // start background refresh loop (non-blocking)
        this.startRefreshLoop();

        resolve();
      } catch (err) {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message || String(err);
        resolve();
      }
    });
  }

  // loginUser
  loginUser({ EMAIL, PASSWORD }) {
    return new Promise(async (resolve) => {
      try {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.APIkey}`;
        const { ok, result } = await this._fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
        });

        if (!ok) throw new Error(result?.error?.message || 'Sign-in failed');

        this.idToken = result.idToken;
        this.refreshToken = result.refreshToken;
        this.localId = result.localId;

        this.loggedIn = true;
        this.failed = false;
        this.error = "";

        // start background refresh loop (non-blocking)
        this.startRefreshLoop();

        resolve();
      } catch (err) {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message || String(err);
        resolve();
      }
    });
  }

  // logout stops refresh loop
  logoutUser() {
    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";
    this.loggedIn = false;
    this.failed = false;
    this.error = "";

    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // deleteUser
  deleteUser() {
    return new Promise(async (resolve) => {
      try {
        if (!this.loggedIn) {
          this.failed = true;
          this.error = "Not logged in";
          resolve();
          return;
        }

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.APIkey}`;
        const { ok, result } = await this._fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: this.idToken })
        });

        if (!ok) throw new Error(result?.error?.message || 'Delete failed');

        // clear local state
        this.idToken = "";
        this.refreshToken = "";
        this.localId = "";
        this.loggedIn = false;
        this.failed = false;
        this.error = "";

        if (this.refreshInterval) {
          clearTimeout(this.refreshInterval);
          this.refreshInterval = null;
        }

        resolve();
      } catch (err) {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message || String(err);
        resolve();
      }
    });
  }

  // Background refresh loop using setTimeout recursion (non-blocking)
  startRefreshLoop() {
    if (!this.loggedIn || this.refreshInterval) return;

    const refreshTokenFunc = async () => {
      if (!this.loggedIn) return;
      try {
        const url = `https://securetoken.googleapis.com/v1/token?key=${this.APIkey}`;
        const { ok, result } = await this._fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken, grant_type: "refresh_token" })
        });

        if (!ok) throw new Error(result?.error?.message || 'Refresh failed');

        // API returns id_token on success
        this.idToken = result.id_token || result.idToken || this.idToken;
        this.failed = false;

        // schedule next refresh
        this.refreshInterval = setTimeout(refreshTokenFunc, 3590000);
      } catch (err) {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message || String(err);
      }
    };

    // schedule first refresh ~1 hour from now
    this.refreshInterval = setTimeout(refreshTokenFunc, 3590000);
  }

  // sendData -> PUT (replace node)
  sendData({ DATA, PATH }) {
    return new Promise(async (resolve) => {
      try {
        if (!this.loggedIn) throw new Error("Not logged in");

        const base = this._baseURL();
        const path = this._normalizePath(PATH);
        const url = `${base}/${path}.json?auth=${this.idToken}`;

        const payload = this._parseData(DATA);
        const { ok, result } = await this._fetchJson(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!ok) throw new Error(result?.error?.message || "sendData failed");

        this.failed = false;
        this.error = "";
        resolve();
      } catch (err) {
        this.failed = true;
        this.error = err.message || String(err);
        resolve();
      }
    });
  }

  // changeData -> PATCH (partial update)
  changeData({ DATA, PATH }) {
    return new Promise(async (resolve) => {
      try {
        if (!this.loggedIn) throw new Error("Not logged in");

        const base = this._baseURL();
        const path = this._normalizePath(PATH);
        const url = `${base}/${path}.json?auth=${this.idToken}`;

        const payload = this._parseData(DATA);
        const { ok, result } = await this._fetchJson(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!ok) throw new Error(result?.error?.message || "changeData failed");

        this.failed = false;
        this.error = "";
        resolve();
      } catch (err) {
        this.failed = true;
        this.error = err.message || String(err);
        resolve();
      }
    });
  }

  // getData -> returns stringified JSON to the reporter
  getData({ PATH }) {
    return new Promise(async (resolve) => {
      try {
        if (!this.loggedIn) throw new Error("Not logged in");

        const base = this._baseURL();
        const path = this._normalizePath(PATH);
        const url = `${base}/${path}.json?auth=${this.idToken}`;

        const { ok, result } = await this._fetchJson(url, { method: 'GET' });

        if (!ok) throw new Error(result?.error?.message || "getData failed");

        this.failed = false;
        this.error = "";
        resolve(JSON.stringify(result));
      } catch (err) {
        this.failed = true;
        this.error = err.message || String(err);
        resolve("");
      }
    });
  }
}

Scratch.extensions.register(new FirebaseData());
