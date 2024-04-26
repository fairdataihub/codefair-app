import { MongoClient } from 'mongodb'

const uri: any = process.env.MONGODB_URI
console.log(typeof uri, 'URL Type')
const options = {}

let client: any
let clientPromise: any

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local')
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).

  let { _mongoClientPromise }: any = global

  if (!_mongoClientPromise) {
    client = new MongoClient(uri, options)

    _mongoClientPromise = client.connect()
  }
  clientPromise = _mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  console.log(typeof client, 'client type')

  clientPromise = client.connect()
  console.log(typeof clientPromise, 'Client Promise type')
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise