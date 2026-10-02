import { createApp } from './app';
import { loadConfig } from './config';
import { connectDatabase, disconnectDatabase, ensureIndexes } from './db/connection';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config.logLevel);

await connectDatabase(config.mongodbUri);
await ensureIndexes();

const app = createApp({ config, logger });
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, pid: process.pid }, 'Seatly API listening');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
