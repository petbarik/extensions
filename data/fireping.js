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
        {
          opcode: 'failedLast',
          blockType: 'Boolean',
          text: 'failed?',
          arguments: {}
        },
        {
          opcode: 'getError',
          blockType: 'reporter',
          text: 'last fetch response',
          arguments: {}
        },
        {
          opcode: 'getErrorMessage',
          blockType: 'reporter',
          text: 'last error message',
          arguments: {}
        },
        {
          opcode: 'isLoggedIn',
          blockType: 'Boolean',
          text: 'logged in?',
          arguments: {}
        },
        {
          opcode: 'getLocalId',
          blockType: 'reporter',
          text: 'get current user UID',
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
            PATH: { type: 'string', defaultValue: 'user.json' }
          }
        },
        {
          opcode: 'changeData',
          blockType: 'command',
          text: 'update data [DATA] at path [PATH]',
          arguments: {
            DATA: { type: 'string', defaultValue: '{"key":"value"}' },
            PATH: { type: 'string', defaultValue: 'user.json' }
          }
        },
        {
          opcode: 'getData',
          blockType: 'reporter',
          text: 'get data at path [PATH]',
          arguments: {
            PATH: { type: 'string', defaultValue: 'user.json' }
          }
        }
      ]
    };
  }

  setFireBase({ URL, API }) {
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() {
    return this.failed;
  }

  getError() {
    return this.lastResponse ? JSON.stringify(this.lastResponse, null, 2) : "No fetch yet";
  }

  getErrorMessage() {
    return this.lastMessage || "No error yet.";
  }

  isLoggedIn() {
    return this.loggedIn;
  }

  getLocalId() {
    return this.localId || "";
  }

  createUser({ EMAIL, PASSWORD }) {
    return new Promise(resolve => {
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          if (!ok) {
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
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown error.";
          this.lastResponse = null;
          resolve();
        });
    });
  }

  loginUser({ EMAIL, PASSWORD }) {
    return new Promise(resolve => {
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          if (!ok) {
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
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown error.";
          this.lastResponse = null;
          resolve();
        });
    });
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

  deleteUser() {
    return new Promise(resolve => {
      if (!this.loggedIn) {
        this.failed = true;
        this.lastMessage = "Not logged in.";
        resolve();
        return;
      }

      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: this.idToken })
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          if (!ok) {
            this.failed = true;
            this.lastMessage = data.error?.message || "Delete failed.";
          } else {
            this.logoutUser();
            this.failed = false;
            this.lastMessage = "User deleted successfully!";
          }
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown error.";
          this.lastResponse = null;
          resolve();
        });
    });
  }

  sendData({ DATA, PATH }) {
    return new Promise(resolve => {
      let jsonData;
      try {
        jsonData = JSON.parse(DATA);
      } catch {
        this.failed = true;
        this.lastMessage = "Invalid JSON input.";
        resolve();
        return;
      }

      fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          this.failed = !ok;
          this.lastMessage = ok ? "Data stored successfully!" : (data.error?.message || "Error storing data.");
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown error.";
          this.lastResponse = null;
          resolve();
        });
    });
  }

  changeData({ DATA, PATH }) {
    return new Promise(resolve => {
      let jsonData;
      try {
        jsonData = JSON.parse(DATA);
      } catch {
        this.failed = true;
        this.lastMessage = "Invalid JSON input.";
        resolve();
        return;
      }

      fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          this.failed = !ok;
          this.lastMessage = ok ? "Data updated successfully!" : (data.error?.message || "Error updating data.");
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown error.";
          this.lastResponse = null;
          resolve();
        });
    });
  }

  getData({ PATH }) {
    return new Promise(resolve => {
      fetch(`${this.dataBaseURL}${PATH}.json?auth=${this.idToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          this.lastResponse = data;
          if (!ok) {
            this.failed = true;
            this.lastMessage = data.error?.message || "Failed to fetch data.";
            resolve("");
          } else {
            this.failed = false;
            this.lastMessage = "Data fetched successfully!";
            resolve(JSON.stringify(data, null, 2));
          }
        })
        .catch(err => {
          this.failed = true;
          this.lastMessage = err.message || "Unknown fetch error.";
          this.lastResponse = null;
          resolve("");
        });
    });
  }
}

Scratch.extensions.register(new FirebaseData());
