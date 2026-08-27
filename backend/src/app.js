import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
