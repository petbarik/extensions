class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";
    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";
    this.failed = false;
    this.loggedIn = false;
    this.lastResponse = null;
    this.lastMessage = "";
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
            URL: { type: 'string', defaultValue: 'https://yourdatabase.firebaseio.com/' },
            API: { type: 'string', defaultValue: 'AIza...' }
          }
        },
        { opcode: 'failedLast', blockType: 'Boolean', text: 'failed?', arguments: {} },
        { opcode: 'getError', blockType: 'reporter', text: 'last fetch response', arguments: {} },
        { opcode: 'getErrorMessage', blockType: 'reporter', text: 'last error message', arguments: {} },
        { opcode: 'isLoggedIn', blockType: 'Boolean', text: 'logged in?', arguments: {} },
        { opcode: 'getLocalId', blockType: 'reporter', text: 'get current user UID', arguments: {} },
        {
          opcode: 'createUser',
          blockType: 'command',
          text: 'create account with email [EMAIL] password [PASSWORD]',
          arguments: { EMAIL: { type: 'string', defaultValue: 'you@example.com' }, PASSWORD: { type: 'string', defaultValue: 'Secret123' } }
        },
        {
          opcode: 'loginUser',
          blockType: 'command',
          text: 'login account with email [EMAIL] password [PASSWORD]',
          arguments: { EMAIL: { type: 'string', defaultValue: 'you@example.com' }, PASSWORD: { type: 'string', defaultValue: 'Secret123' } }
        },
        { opcode: 'logoutUser', blockType: 'command', text: 'logout current account', arguments: {} },
        { opcode: 'deleteUser', blockType: 'command', text: 'delete current account', arguments: {} },
        {
          opcode: 'sendData',
          blockType: 'command',
          text: 'send data [DATA] and store it at path [PATH]',
          arguments: { DATA: { type: 'string', defaultValue: '{"key":"value"}' }, PATH: { type: 'string', defaultValue: 'user.json' } }
        },
        {
          opcode: 'changeData',
          blockType: 'command',
          text: 'update data [DATA] at path [PATH]',
          arguments: { DATA: { type: 'string', defaultValue: '{"key":"value"}' }, PATH: { type: 'string', defaultValue: 'user.json' } }
        },
        {
          opcode: 'getData',
          blockType: 'reporter',
          text: 'get data at path [PATH]',
          arguments: { PATH: { type: 'string', defaultValue: 'user.json' } }
        }
      ]
    };
  }

  setFireBase({ URL, API }) {
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() { return this.failed; }
  getError() { return this.lastResponse ? JSON.stringify(this.lastResponse, null, 2) : "No fetch yet"; }
  getErrorMessage() { return this.lastMessage || "No error yet."; }
  isLoggedIn() { return this.loggedIn; }
  getLocalId() { return this.localId || ""; }

  async createUser({ EMAIL, PASSWORD }) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.APIkey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;

    if (!res.ok) {
      this.failed = true;
      this.lastMessage = data.error?.message || "Account creation failed.";
    } else {
      this.idToken = data.idToken;
      this.refreshToken = data.refreshToken;
      this.localId = data.localId;
      this.loggedIn = true;
      this.failed = false;
      this.lastMessage = "Account created successfully!";
    }
  }

  async loginUser({ EMAIL, PASSWORD }) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.APIkey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;

    if (!res.ok) {
      this.failed = true;
      this.lastMessage = data.error?.message || "Login failed.";
    } else {
      this.idToken = data.idToken;
      this.refreshToken = data.refreshToken;
      this.localId = data.localId;
      this.loggedIn = true;
      this.failed = false;
      this.lastMessage = "Logged in successfully!";
    }
  }

  logoutUser() {
    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";
    this.loggedIn = false;
    this.failed = false;
    this.lastMessage = "Logged out successfully.";
    this.lastResponse = null;
  }

  async deleteUser() {
    if (!this.loggedIn) {
      this.failed = true;
      this.lastMessage = "Not logged in.";
      return;
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.APIkey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: this.idToken })
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;

    if (!res.ok) {
      this.failed = true;
      this.lastMessage = data.error?.message || "Delete failed.";
    } else {
      this.logoutUser();
      this.failed = false;
      this.lastMessage = "User deleted successfully!";
    }
  }

  async sendData({ DATA, PATH }) {
    let jsonData;
    try { jsonData = JSON.parse(DATA); }
    catch { this.failed = true; this.lastMessage = "Invalid JSON input."; return; }

    const res = await fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;
    this.failed = !res.ok;
    this.lastMessage = res.ok ? "Data stored successfully!" : (data.error?.message || "Error storing data.");
  }

  async changeData({ DATA, PATH }) {
    let jsonData;
    try { jsonData = JSON.parse(DATA); }
    catch { this.failed = true; this.lastMessage = "Invalid JSON input."; return; }

    const res = await fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;
    this.failed = !res.ok;
    this.lastMessage = res.ok ? "Data updated successfully!" : (data.error?.message || "Error updating data.");
  }

  async getData({ PATH }) {
    const res = await fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    this.lastResponse = data;

    if (!res.ok) {
      this.failed = true;
      this.lastMessage = data.error?.message || "Failed to fetch data.";
      return "";
    }
    this.failed = false;
    this.lastMessage = "Data fetched successfully!";

    if (data === null) return "null";
    if (typeof data === "object") return JSON.stringify(data, null, 2);
    return String(data);
  }
}

Scratch.extensions.register(new FirebaseData());
