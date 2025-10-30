class FirebaseData {
  getInfo() {
    return {
      id: 'firebaseData',
      name: 'Firebase Data',
      blocks: [
        {
          opcode: 'saveData',
          blockType: Scratch.BlockType.COMMAND,
          text: 'save key [KEY] value [VALUE]',
          arguments: {
            KEY: { type: Scratch.ArgumentType.STRING, defaultValue: 'playerScore' },
            VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: '100' }
          }
        },
        {
          opcode: 'loadData',
          blockType: Scratch.BlockType.REPORTER,
          text: 'load key [KEY]',
          arguments: {
            KEY: { type: Scratch.ArgumentType.STRING, defaultValue: 'playerScore' }
          }
        }
      ]
    };
  }

  async saveData(args) {
    const dbUrl = 'https://penguinmod-games-default-rtdb.firebaseio.com/';
    await fetch(`${dbUrl}${args.KEY}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args.VALUE)
    });
  }

  async loadData(args) {
    const dbUrl = 'https://penguinmod-games-default-rtdb.firebaseio.com/';
    const res = await fetch(`${dbUrl}${args.KEY}.json`);
    const data = await res.json();
    return data ?? '';
  }
}

Scratch.extensions.register(new FirebaseData());
