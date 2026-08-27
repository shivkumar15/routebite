import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
} from '../constants/auth.constants.js';
import { env } from '../config/env.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from '../services/auth.service.js';

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
    const user = await getCurrentUser(req.auth.userId);

    res.status(200).json({
      success: true,
      data: {
        user,
        partner: {
          exists: false,
          verificationStatus: null,
          availabilityStatus: null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
