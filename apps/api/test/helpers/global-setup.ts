import mongoose from 'mongoose';

/** Fails fast, with instructions, when the replica set isn't running. */
export default async function globalSetup() {
  const uri = process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/?replicaSet=rs0';
  const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 4000 });
  try {
    await conn.asPromise();
    const hello = (await conn.db!.admin().command({ hello: 1 })) as { setName?: string };
    if (!hello.setName) throw new Error('server is not a replica set member');
  } catch (err) {
    throw new Error(
      `API integration tests need a MongoDB replica set at ${uri}.\n` +
        `Start it with \`npm run db:up\` (docker compose, mongo:8.0, rs0). Cause: ${(err as Error).message}`,
      { cause: err },
    );
  } finally {
    await conn.close().catch(() => undefined);
  }
}
