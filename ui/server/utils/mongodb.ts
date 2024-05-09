import { MongoClient } from "mongodb";

const uri: any = process.env.MONGODB_URI;
const options = {};

let client: any;
// eslint-disable-next-line import/no-mutable-exports
let clientPromise: any;

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env");
}

if (!process.env.MONGODB_DB_NAME) {
  throw new Error("Please add your Mongo DB Name to .env");
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).

  let { _mongoClientPromise }: any = global;

  if (!_mongoClientPromise) {
    client = new MongoClient(uri, options);

    _mongoClientPromise = client.connect();
  }
  clientPromise = _mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);

  clientPromise = client.connect();
}

export interface DatabaseUser {
  id: String;
  username: String;
  access_token: String;
  github_id: Number;
}

export interface DatabaseSession {
  id: String;
  access_token: String;
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
