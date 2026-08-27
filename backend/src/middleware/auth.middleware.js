import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, USER_ROLES } from '../constants/auth.constants.js';
import { PARTNER_VERIFICATION_STATUS } from '../constants/partner.constants.js';
import { env } from '../config/env.js';
import { Partner } from '../models/partner.model.js';
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

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== USER_ROLES.ADMIN) {
    return next(
      new AppError('Administrator access required.', {
        statusCode: 403,
        code: 'ADMIN_REQUIRED',
      }),
    );
  }

  return next();
}

export async function requireApprovedPartner(req, res, next) {
  try {
    if (req.auth?.role === USER_ROLES.ADMIN) {
      throw new AppError('Administrator accounts cannot use delivery-partner capabilities.', {
        statusCode: 403,
        code: 'ADMIN_PARTNER_CONFLICT',
      });
    }

    const partner = await Partner.findOne({ userId: req.auth.userId }).select(
      '_id verificationStatus',
    );

    if (!partner || partner.verificationStatus !== PARTNER_VERIFICATION_STATUS.APPROVED) {
      throw new AppError('Approved partner access required.', {
        statusCode: 403,
        code: 'APPROVED_PARTNER_REQUIRED',
      });
    }

    req.auth.partnerId = partner._id.toString();
    return next();
  } catch (error) {
    return next(error);
  }
}
