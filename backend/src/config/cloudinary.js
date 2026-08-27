import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { AppError } from '../utils/app-error.js';

let configured = false;

function hasCloudinaryCredentials() {
  return Boolean(
    env.cloudinary.cloudName &&
      env.cloudinary.apiKey &&
      env.cloudinary.apiSecret,
  );
}

export function ensureCloudinaryConfigured() {
  if (!hasCloudinaryCredentials()) {
    throw new AppError('Cloudinary is not configured for uploads yet.', {
      statusCode: 503,
      code: 'UPLOAD_PROVIDER_NOT_CONFIGURED',
    });
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}
