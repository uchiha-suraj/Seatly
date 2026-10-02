import { loadConfig } from '../src/config';
import { connectDatabase, disconnectDatabase } from '../src/db/connection';
import { resetDemoEvent } from '../src/db/seed';

const config = loadConfig();
if (!config.demoMode) {
  console.error('Refusing to reset: set DEMO_MODE=true (never in production).');
  process.exit(1);
}
await connectDatabase(config.mongodbUri);
const r = await resetDemoEvent(process.argv[2] ?? 'demo-last-seat');
console.log(`Demo event reset. Removed ${r.bookingsRemoved} booking(s); the seat is available again.`);
await disconnectDatabase();
