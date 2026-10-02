import mongoose from 'mongoose';
import { allModels } from './models';

/**
 * Connects and refuses to continue unless the server is a replica-set member:
 * multi-document transactions do not exist on a standalone mongod.
 */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  await assertReplicaSet();
  return mongoose;
}

export async function assertReplicaSet(): Promise<string> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Not connected');
  const hello = (await db.admin().command({ hello: 1 })) as { setName?: string };
  if (!hello.setName) {
    throw new Error(
      'MongoDB is not running as a replica set. Transactions require one — start it with `npm run db:up` ' +
        'or use a connection string with ?replicaSet=rs0.',
    );
  }
  return hello.setName;
}

/** Creates every declared index (including the unique ones the booking invariant depends on). */
export async function ensureIndexes(): Promise<void> {
  for (const model of allModels) {
    await model.createCollection().catch(() => undefined);
    await model.syncIndexes();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
