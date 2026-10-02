import mongoose from 'mongoose';
import { loadConfig } from '../src/config';
import { connectDatabase, disconnectDatabase } from '../src/db/connection';

const config = loadConfig();
try {
  await connectDatabase(config.mongodbUri);
  const admin = mongoose.connection.db!.admin();
  const hello = (await admin.command({ hello: 1 })) as { setName?: string; primary?: string; isWritablePrimary?: boolean };
  const build = (await admin.command({ buildInfo: 1 })) as { version: string };
  console.log(`OK  replica set: ${hello.setName}  primary: ${hello.primary}  writable primary: ${hello.isWritablePrimary}  server: ${build.version}`);
} catch (err) {
  console.error(`FAILED: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
