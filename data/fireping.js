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
          }
        },
      ]
    };
  }
  async setFireBase({ URL, API }) {
    this.dataBaseURL = ${URL};
    this.APIkey = ${API};
  }
}

Scratch.extensions.register(new FirebaseData());
