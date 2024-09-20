import { MongoClient } from "mongodb";

const transferPostgres = async () => {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  await client.connect();

  const mongoDB = client.db("dev");
};
