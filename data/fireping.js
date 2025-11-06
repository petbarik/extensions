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

  setFireBase({ URL, API }) {
    this.dataBaseURL = URL;
    this.APIkey = API;
  }

  failedLast() {
    return this.failed;
  }

  getError() {
    return this.error;
  }

  isLoggedIn() {
    return this.loggedIn;
  }

  getLocalId() {
    return this.localId || "";
  }

  createUser({ EMAIL, PASSWORD }) {
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.APIkey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          this.failed = true;
          this.loggedIn = false;
          this.error = data.error.message;
        } else {
          this.idToken = data.idToken;
          this.refreshToken = data.refreshToken;
          this.localId = data.localId;
          this.loggedIn = true;
          this.failed = false;
          this.error = "";
        }
      })
      .catch(err => {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message;
      });
  }

  loginUser({ EMAIL, PASSWORD }) {
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.APIkey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          this.failed = true;
          this.loggedIn = false;
          this.error = data.error.message;
        } else {
          this.idToken = data.idToken;
          this.refreshToken = data.refreshToken;
          this.localId = data.localId;
          this.loggedIn = true;
          this.failed = false;
          this.error = "";
        }
      })
      .catch(err => {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message;
      });
  }

  logoutUser() {
    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";
    this.loggedIn = false;
    this.failed = false;
    this.error = "";
  }

  deleteUser() {
    if (!this.loggedIn) {
      this.failed = true;
      this.error = "Not logged in";
      return;
    }

    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.APIkey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: this.idToken })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          this.failed = true;
          this.loggedIn = false;
          this.error = data.error.message;
        } else {
          this.idToken = "";
          this.refreshToken = "";
          this.localId = "";
          this.loggedIn = false;
          this.failed = false;
          this.error = "";
        }
      })
      .catch(err => {
        this.failed = true;
        this.loggedIn = false;
        this.error = err.message;
      });
  }

  sendData({ DATA, PATH }) {
    fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: DATA
    })
      .then(() => { this.failed = false; this.error = ""; })
      .catch(err => { this.failed = true; this.error = err.message; });
  }

  changeData({ DATA, PATH }) {
    fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: DATA
    })
      .then(() => { this.failed = false; this.error = ""; })
      .catch(err => { this.failed = true; this.error = err.message; });
  }

  getData({ PATH }) {
    return fetch(this.dataBaseURL + PATH + "?auth=" + this.idToken, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        this.failed = false;
        this.error = "";
        return JSON.stringify(data);
      })
      .catch(err => {
        this.failed = true;
        this.error = err.message;
        return "";
      });
  }
}

Scratch.extensions.register(new FirebaseData());
