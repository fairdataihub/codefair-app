import { MongoClient } from "mongodb";
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

class Database {
  constructor() {
    if (!Database.instance) {
      this.client = new MongoClient(MONGODB_URI, {});
      Database.instance = this;
    }

    return Database.instance;
  }

  async connect() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(MONGODB_DB_NAME);
    }

    return this.db;
  }

  getDb() {
    return this.db;
  }
}

const instance = new Database();
// Object.freeze(instance);

export default instance;
