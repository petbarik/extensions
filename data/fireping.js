class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";

    this.idToken = "";
    this.refreshToken = "";
    this.localId = "";

    this.failed = false;
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
          text: 'failed last action?',
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
    return this.failed
  }

  async createUser({ EMAIL, PASSWORD, USERNAME }) {
    try {
    const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + this.APIkey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({"email":EMAIL,"password":PASSWORD,"returnSecureToken":true})
    });
    const result = await response.json();
    this.idToken = result.idToken
    this.refreshToken = result.refreshToken
    this.localId = result.localId
      this.failed = false;
    } catch(error) {
      this.failed = true;
    }
  } 
}

Scratch.extensions.register(new FirebaseData());
