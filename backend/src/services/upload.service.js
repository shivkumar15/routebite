import { ensureCloudinaryConfigured } from '../config/cloudinary.js';
import { UploadAsset } from '../models/upload-asset.model.js';
import { AppError } from '../utils/app-error.js';

function uploadBuffer(cloudinary, file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        type: 'authenticated',
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(file.buffer);
  });
}

export async function createUploadAsset({ userId, purpose, file }) {
  if (!file) {
    throw new AppError('Choose an image to upload.', {
      statusCode: 400,
      code: 'UPLOAD_FILE_REQUIRED',
    });
  }

  const cloudinary = ensureCloudinaryConfigured();
  let uploaded;

  try {
    uploaded = await uploadBuffer(
      cloudinary,
      file,
      `routebite/users/${userId}/${purpose.toLowerCase()}`,
    );
  } catch (error) {
    throw new AppError('The image upload failed. Please try again.', {
      statusCode: 502,
      code: 'UPLOAD_PROVIDER_FAILED',
      details: null,
    });
  }

  try {
    const asset = await UploadAsset.create({
      ownerUserId: userId,
      purpose,
      publicId: uploaded.public_id,
      resourceType: uploaded.resource_type ?? 'image',
      deliveryType: uploaded.type ?? 'authenticated',
      format: uploaded.format,
      mimeType: file.mimetype,
      bytes: uploaded.bytes ?? file.size,
    });

    return {
      id: asset._id.toString(),
      purpose: asset.purpose,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
    };
  } catch (error) {
    await cloudinary.uploader.destroy(uploaded.public_id, {
      resource_type: uploaded.resource_type ?? 'image',
      type: uploaded.type ?? 'authenticated',
      invalidate: true,
    }).catch(() => {});

    throw error;
  }
}

export function createAuthenticatedAssetUrl(asset) {
  const cloudinary = ensureCloudinaryConfigured();

  return cloudinary.url(asset.publicId, {
    resource_type: asset.resourceType ?? 'image',
    type: asset.deliveryType ?? 'authenticated',
    secure: true,
    sign_url: true,
  });
}
