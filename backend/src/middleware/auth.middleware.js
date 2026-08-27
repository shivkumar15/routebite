import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants.js';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new AppError('Authentication required.', {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new AppError('Your session is invalid or has expired.', {
        statusCode: 401,
        code: 'INVALID_SESSION',
      });
    }

    const user = await User.findById(payload.sub).select('tokenVersion role');

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new AppError('Your session is no longer valid.', {
        statusCode: 401,
        code: 'INVALID_SESSION',
      });
    }

    req.auth = {
      userId: user._id.toString(),
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
