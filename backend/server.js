import http from 'node:http';
import mongoose from 'mongoose';
import app from './src/app.js';
import { connectDatabase } from './src/config/db.js';
import { env } from './src/config/env.js';
import { resumeDueMatchingAttempts } from './src/services/matching-orchestration.service.js';
import { createSocketServer } from './src/socket/index.js';

const httpServer = http.createServer(app);
createSocketServer(httpServer);
let matchingTimer = null;

async function runMatchingResumeJob() {
  try {
    await resumeDueMatchingAttempts();
  } catch (error) {
    console.error('Matching resume job failed', error.message);
  }
}

async function start() {
  try {
    await connectDatabase();
    await runMatchingResumeJob();

    matchingTimer = setInterval(runMatchingResumeJob, 60 * 1000);
    matchingTimer.unref?.();

    httpServer.listen(env.port, () => {
      console.log(`RouteBite API listening on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start RouteBite API', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  if (matchingTimer) clearInterval(matchingTimer);

  httpServer.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
