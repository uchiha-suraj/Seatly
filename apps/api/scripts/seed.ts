import { loadConfig } from '../src/config';
import { connectDatabase, disconnectDatabase, ensureIndexes } from '../src/db/connection';
import { seedDatabase } from '../src/db/seed';
import { systemClock } from '../src/lib/clock';

const config = loadConfig();
await connectDatabase(config.mongodbUri);
await ensureIndexes();
const result = await seedDatabase(systemClock);
console.log(`Seeded ${result.events} events and ${result.seats} seats (idempotent — safe to run again).`);
await disconnectDatabase();
