import multer from 'multer';
import { AppError } from '../utils/app-error.js';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new AppError('Upload a JPEG, PNG, or WebP image.', {
          statusCode: 400,
          code: 'UNSUPPORTED_UPLOAD_TYPE',
        }),
      );
    }

    return callback(null, true);
  },
});

export function uploadSingleImage(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(
        new AppError(
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Image must be 5 MB or smaller.'
            : 'Invalid upload request.',
          {
            statusCode,
            code: error.code,
          },
        ),
      );
    }

    return next(error);
  });
}
