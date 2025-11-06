class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";

    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";

    this.username = "";

    this.failed = false;
    this.error = "";
    this.logedin = false;
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
          text: 'loged in?',
          arguments: {}
        },
        {
          opcode: 'getUsername',
          blockType: 'reporter',
          text: 'username',
          arguments: {}
        },
        {
          opcode: 'createUser',
          blockType: 'command',
          text: 'create user with email [EMAIL] password [PASSWORD] and username [USERNAME]',
          arguments: {
            EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' },
            PASSWORD: { type: 'string', defaultValue: 'Secret123' },
            USERNAME: { type: 'string', defaultValue: 'yourusername' }
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
    return this.logedin;
  }

  getUsername() {
    return this.username;
  }

  async createUser({ EMAIL, PASSWORD, USERNAME }) {
    try {
      const responseAuth = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + this.APIkey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
          returnSecureToken: true
        })
      });

      const result = await responseAuth.json();

      if (!responseAuth.ok) {
        throw new Error(result.error?.message || "Firebase sign-up failed");
      }

      this.idToken = result.idToken;
      this.refreshToken = result.refreshToken;
      this.localId = result.localId;
      this.username = USERNAME;

      await fetch(this.dataBaseURL + "users/" + this.localId + ".json?auth=" + this.idToken, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, username: USERNAME })
      });

      await fetch(this.dataBaseURL + "usernames.json?auth=" + this.idToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [USERNAME]: this.localId })
      });

      this.logedin = true;
      this.failed = false;
      this.error = "";
    } catch (error) {
      this.failed = true;
      this.logedin = false;
      this.username = "";
      this.error = error.message || String(error);
      console.error("Firebase createUser failed:", error);
    }
  }
}

Scratch.extensions.register(new FirebaseData());
