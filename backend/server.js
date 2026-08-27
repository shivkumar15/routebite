import http from 'node:http';
import mongoose from 'mongoose';
import app from './src/app.js';
import { connectDatabase } from './src/config/db.js';
import { env } from './src/config/env.js';
import { DELIVERY_OPERATION_LIMITS } from './src/constants/delivery.constants.js';
import { OFFER_LIMITS } from './src/constants/offer.constants.js';
import { expireDuePriceConfirmations } from './src/services/delivery.service.js';
import { resumeDueMatchingAttempts } from './src/services/matching-orchestration.service.js';
import { runOfferMaintenance } from './src/services/offer-maintenance.service.js';
import { createSocketServer } from './src/socket/index.js';

const httpServer = http.createServer(app);
createSocketServer(httpServer);
let matchingTimer = null;
let offerTimer = null;
let priceConfirmationTimer = null;

async function runMatchingResumeJob() {
  try {
    await resumeDueMatchingAttempts();
  } catch (error) {
    console.error('Matching resume job failed', error.message);
  }
}

async function runOfferMaintenanceJob() {
  try {
    await runOfferMaintenance();
  } catch (error) {
    console.error('Offer maintenance job failed', error.message);
  }
}

async function runPriceConfirmationJob() {
  try {
    await expireDuePriceConfirmations();
  } catch (error) {
    console.error('Price confirmation maintenance failed', error.message);
  }
}

async function start() {
  try {
    await connectDatabase();
    await runMatchingResumeJob();
    await runOfferMaintenanceJob();
    await runPriceConfirmationJob();

    matchingTimer = setInterval(runMatchingResumeJob, 60 * 1000);
    matchingTimer.unref?.();

    offerTimer = setInterval(
      runOfferMaintenanceJob,
      OFFER_LIMITS.EXPIRY_SCAN_INTERVAL_MS,
    );
    offerTimer.unref?.();

    priceConfirmationTimer = setInterval(
      runPriceConfirmationJob,
      DELIVERY_OPERATION_LIMITS.PRICE_CONFIRMATION_SCAN_INTERVAL_MS,
    );
    priceConfirmationTimer.unref?.();

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
  if (offerTimer) clearInterval(offerTimer);
  if (priceConfirmationTimer) clearInterval(priceConfirmationTimer);

  httpServer.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();