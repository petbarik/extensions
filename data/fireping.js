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
          blockType: 'reporter',
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
          blockType: 'reporter',
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

  createUser({ EMAIL, PASSWORD }) {
    return new Promise(resolve => {
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
      })
        .then(response => response.json().then(result => ({ ok: response.ok, result })))
        .then(({ ok, result }) => {
          if (!ok) throw new Error(result.error?.message || "Firebase sign-up failed");
          this.idToken = result.idToken;
          this.refreshToken = result.refreshToken;
          this.localId = result.localId;
          this.loggedIn = true;
          this.failed = false;
          this.error = "";
          this.startRefreshLoop();
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.loggedIn = false;
          this.error = err.message || String(err);
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
        .then(response => response.json().then(result => ({ ok: response.ok, result })))
        .then(({ ok, result }) => {
          if (!ok) throw new Error(result.error?.message || "Firebase login failed");
          this.idToken = result.idToken;
          this.refreshToken = result.refreshToken;
          this.localId = result.localId;
          this.loggedIn = true;
          this.failed = false;
          this.error = "";
          this.startRefreshLoop();
          resolve();
        })
        .catch(err => {
          this.failed = true;
          this.loggedIn = false;
          this.error = err.message || String(err);
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
    this.error = "";

    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  startRefreshLoop() {
    if (!this.loggedIn || this.refreshInterval) return;

    const refreshTokenFunc = () => {
      if (!this.loggedIn) return;
      fetch(`https://securetoken.googleapis.com/v1/token?key=${this.APIkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken, grant_type: "refresh_token" })
      })
        .then(response => response.json().then(result => ({ ok: response.ok, result })))
        .then(({ ok, result }) => {
          if (!ok) throw new Error(result.error?.message || "Firebase refresh failed");
          this.idToken = result.id_token;
          this.failed = false;
          this.refreshInterval = setTimeout(refreshTokenFunc, 3590000); // ~1h
        })
        .catch(err => {
          this.failed = true;
          this.loggedIn = false;
          this.error = err.message || String(err);
        });
    };

    this.refreshInterval = setTimeout(refreshTokenFunc, 3590000);
  }
}

Scratch.extensions.register(new FirebaseData());
