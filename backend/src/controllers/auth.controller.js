import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
} from '../constants/auth.constants.js';
import { env } from '../config/env.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  requestEmailOtp,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from '../services/auth.service.js';
import { getPartnerCapabilityForUser } from '../services/partner.service.js';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

export async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    setAuthCookie(res, result.token);

    res.status(201).json({
      success: true,
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);
    setAuthCookie(res, result.token);

    res.status(200).json({
      success: true,
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    data: null,
  });
}

export async function me(req, res, next) {
  try {
    const [user, partner] = await Promise.all([
      getCurrentUser(req.auth.userId),
      getPartnerCapabilityForUser(req.auth.userId),
    ]);

    res.status(200).json({
      success: true,
      data: { user, partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function requestEmailVerification(req, res, next) {
  try {
    const result = await requestEmailOtp(req.auth.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailVerification(req, res, next) {
  try {
    const user = await verifyEmailOtp({
      userId: req.auth.userId,
      otp: req.body.otp,
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function requestPhoneVerification(req, res, next) {
  try {
    const result = await requestPhoneOtp(req.auth.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPhoneVerification(req, res, next) {
  try {
    const user = await verifyPhoneOtp({
      userId: req.auth.userId,
      otp: req.body.otp,
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}
