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
    this.lastMessage = ""; // user-friendly message
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
          text: 'get current user local id',
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

  // ====== BASIC UTILITY BLOCKS ======
  setFireBase({ URL, API }) {
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() {
    return this.failed;
  }

  getError() {
    return this.lastResponse ? JSON.stringify(this.lastResponse) : "No fetch has been made yet.";
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
  return new Promise(resolve => {
    let jsonData;
    try { 
      jsonData = JSON.parse(DATA); // parse user input string into JSON
    } catch {
      this.failed = true;
      this.lastMessage = "Invalid JSON input";
      resolve();
      return;
    }
    
    fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData) // send as proper JSON
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      this.lastResponse = data;
      if (!ok) {
        this.failed = true;
        this.lastMessage = data.error?.message || "Database request failed";
      } else {
        this.failed = false;
        this.lastMessage = "Data sent successfully!";
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

changeData({ DATA, PATH }) {
  return new Promise(resolve => {
    let jsonData;
    try { 
      jsonData = JSON.parse(DATA);
    } catch {
      this.failed = true;
      this.lastMessage = "Invalid JSON input";
      resolve();
      return;
    }

    fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'PATCH',
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
        this.lastMessage = "Data updated successfully!";
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

getData({ PATH }) {
  return new Promise(resolve => {
    fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      this.lastResponse = data;
      if (!ok) {
        this.failed = true;
        this.lastMessage = data.error?.message || "Fetch failed";
        resolve("");
      } else {
        this.failed = false;
        this.lastMessage = "Data fetched successfully!";
        resolve(data); // return as object, not string
      }
    })
    .catch(err => {
      this.failed = true;
      this.lastMessage = err.message || "Unknown error during fetch";
      this.lastResponse = null;
      resolve("");
    });
  });
  }
}

Scratch.extensions.register(new FirebaseData());
