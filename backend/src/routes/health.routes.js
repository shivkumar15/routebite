import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;

  res.status(mongoReady ? 200 : 503).json({
    status: mongoReady ? 'ok' : 'degraded',
    service: 'routebite-api',
    database: mongoReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
