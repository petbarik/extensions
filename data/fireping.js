class FirebaseData {
  constructor() {
    this.dataBaseURL = "";
    this.APIkey = "";
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
          },
          opcode: 'createUser',
          blockType: 'command',
          text: 'create user with email [EMAIL] password [PASSWORD] and username [USERNAME]',
          arguments: {
            EMAIL: { type: 'string', defaultValue: 'yourname@provider.com' },
            PASSWORD: { type: 'string', defaultValue: 'Secret123' },
            USERNAME: { type: 'string', defaultValue: 'yourusername' }
          }
        },
      ]
    };
  }
  setFireBase({ URL, API }) {
    this.dataBaseURL = ${URL};
    this.APIkey = ${API};
  }

  async createUser({ EMAIL, PASSWORD, USERNAME }) {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + this.APIkey)
  } 
}

Scratch.extensions.register(new FirebaseData());
