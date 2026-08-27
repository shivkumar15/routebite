import { createUploadAsset } from '../services/upload.service.js';

export async function uploadAsset(req, res, next) {
  try {
    const asset = await createUploadAsset({
      userId: req.auth.userId,
      purpose: req.body.purpose,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      data: { asset },
    });
  } catch (error) {
    next(error);
  }
}
