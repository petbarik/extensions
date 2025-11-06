class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";

    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";

    this.failed = false;
    this.loggedIn = false;

    this.lastResponse = null; // raw fetch response
    this.lastMessage = "";    // user-friendly message
  }

  getInfo() {
    return {
      id: 'firePing',
      name: 'Fire Ping',
      blocks: [
        { opcode: 'setFireBase', blockType: 'command', text: 'set database url to [URL] and API to [API]', arguments: { URL: { type: 'string', defaultValue: 'https://yourdatabase.your_region.firebasedatabase.app/' }, API: { type: 'string', defaultValue: 'AIza...' } } },
        { opcode: 'failedLast', blockType: 'Boolean', text: 'failed?', arguments: {} },
        { opcode: 'getError', blockType: 'reporter', text: 'last fetch response', arguments: {} },
        { opcode: 'getErrorMessage', blockType: 'reporter', text: 'last error message', arguments: {} },
        { opcode: 'isLoggedIn', blockType: 'Boolean', text: 'logged in?', arguments: {} },
        { opcode: 'getLocalId', blockType: 'reporter', text: 'get current user local id', arguments: {} },
        { opcode: 'createUser', blockType: 'command', text: 'create account with email [EMAIL] password [PASSWORD]', arguments: { EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' }, PASSWORD: { type: 'string', defaultValue: 'Secret123' } } },
        { opcode: 'loginUser', blockType: 'command', text: 'login account with email [EMAIL] password [PASSWORD]', arguments: { EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' }, PASSWORD: { type: 'string', defaultValue: 'Secret123' } } },
        { opcode: 'logoutUser', blockType: 'command', text: 'logout current account', arguments: {} },
        { opcode: 'deleteUser', blockType: 'command', text: 'delete current account', arguments: {} },
        { opcode: 'sendData', blockType: 'command', text: 'send data [DATA] and store it at path [PATH]', arguments: { DATA: { type: 'string', defaultValue: '{"key":"value"}' }, PATH: { type: 'string', defaultValue: 'user.json' } } },
        { opcode: 'changeData', blockType: 'command', text: 'update data [DATA] at path [PATH]', arguments: { DATA: { type: 'string', defaultValue: '{"key":"value"}' }, PATH: { type: 'string', defaultValue: 'user.json' } } },
        { opcode: 'getData', blockType: 'reporter', text: 'get data at path [PATH]', arguments: { PATH: { type: 'string', defaultValue: 'user.json' } } }
      ]
    };
  }

  // ====== BASIC UTILITY BLOCKS ======
  setFireBase({ URL, API }) {
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() {
    return this.failed;
  }

  getError() {
    return this.lastResponse ?? "No fetch has been made yet.";
  }

  getErrorMessage() {
    return this.lastMessage || "No errors so far.";
  }

  isLoggedIn() {
    return this.loggedIn;
  }

  getLocalId() {
    return this.localId || "";
  }

  // ====== AUTH HELPERS ======
  _fetchAuth(endpoint, body, successMessage) {
    return new Promise(resolve => {
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, returnSecureToken: true })
      })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        this.lastResponse = data;
        if (!ok) {
          this.failed = true;
          this.lastMessage = data.error?.message || `${endpoint} failed`;
        } else {
          this.failed = false;
          this.loggedIn = true;
          this.idToken = data.idToken;
          this.refreshToken = data.refreshToken;
          this.localId = data.localId;
          this.lastMessage = successMessage;
        }
        resolve();
      })
      .catch(err => {
        this.failed = true;
        this.lastMessage = err.message || `Unknown error during ${endpoint}`;
        this.lastResponse = null;
        resolve();
      });
    });
  }

  // ====== ACCOUNT MANAGEMENT ======
  createUser({ EMAIL, PASSWORD }) {
    return this._fetchAuth('signUp', { email: EMAIL, password: PASSWORD }, "User created successfully!");
  }

  loginUser({ EMAIL, PASSWORD }) {
    return this._fetchAuth('signInWithPassword', { email: EMAIL, password: PASSWORD }, "Logged in successfully!");
  }

  logoutUser() {
    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";
    this.loggedIn = false;
    this.failed = false;
    this.lastResponse = null;
    this.lastMessage = "Logged out.";
  }

  deleteUser() {
    return new Promise(resolve => {
      if (!this.loggedIn) {
        this.failed = true;
        this.lastMessage = "Not logged in";
        resolve();
        return;
      }
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: this.idToken })
      })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        this.lastResponse = data;
        if (!ok) {
          this.failed = true;
          this.lastMessage = data.error?.message || "Delete failed";
        } else {
          this.logoutUser();
          this.lastMessage = "User deleted successfully!";
          this.failed = false;
        }
        resolve();
      })
      .catch(err => {
        this.failed = true;
        this.lastMessage = err.message || "Unknown error during deletion";
        this.lastResponse = null;
        resolve();
      });
    });
  }

  // ====== DATA MANAGEMENT ======
  sendData({ DATA, PATH }) {
    return this._sendPatchPut("PUT", DATA, PATH, "Data sent successfully!");
  }

  changeData({ DATA, PATH }) {
    return this._sendPatchPut("PATCH", DATA, PATH, "Data updated successfully!");
  }

  getData({ PATH }) {
    return new Promise(resolve => {
      fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        this.lastResponse = data;
        if (!ok) {
          this.failed = true;
          this.lastMessage = data.error?.message || "Fetch failed";
          resolve(null);
        } else {
          this.failed = false;
          this.lastMessage = "Data fetched successfully!";
          resolve(data); // keep true/false/null as proper types
        }
      })
      .catch(err => {
        this.failed = true;
        this.lastMessage = err.message || "Unknown error during fetch";
        this.lastResponse = null;
        resolve(null);
      });
    });
  }

  _sendPatchPut(method, DATA, PATH, successMessage) {
    return new Promise(resolve => {
      let jsonData;
      try { jsonData = JSON.parse(DATA); } 
      catch { 
        this.failed = true; 
        this.lastMessage = "Invalid JSON input"; 
        resolve(); 
        return; 
      }

      fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        this.lastResponse = data;
        if (!ok) {
          this.failed = true;
          this.lastMessage = data.error?.message || "Database request failed";
        } else {
          this.failed = false;
          this.lastMessage = successMessage;
        }
        resolve();
      })
      .catch(err => {
        this.failed = true;
        this.lastMessage = err.message || "Unknown error during database request";
        this.lastResponse = null;
        resolve();
      });
    });
  }
}

Scratch.extensions.register(new FirebaseData());
