import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { USER_ROLES, AUTH_TOKEN_TTL } from '../constants/auth.constants.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const BCRYPT_ROUNDS = 12;
const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const PHONE_OTP_COOLDOWN_MS = 60 * 1000;
const PHONE_OTP_MAX_ATTEMPTS = 5;

function toSafeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    role: user.role,
  };
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion,
    },
    env.jwtSecret,
    { expiresIn: AUTH_TOKEN_TTL },
  );
}

function hashPhoneOtp(userId, otp) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${userId}:${otp}`)
    .digest('hex');
}

export async function registerUser({ name, email, phone, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
  }).lean();

  if (existing) {
    throw new AppError('An account already exists with this email or phone.', {
      statusCode: 409,
      code: 'ACCOUNT_ALREADY_EXISTS',
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: USER_ROLES.USER,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('An account already exists with this email or phone.', {
        statusCode: 409,
        code: 'ACCOUNT_ALREADY_EXISTS',
      });
    }
    throw error;
  }

  return {
    user: toSafeUser(user),
    token: signAuthToken(user),
  };
}

export async function loginUser({ emailOrPhone, password }) {
  const identity = emailOrPhone.trim();
  const lookup = identity.includes('@')
    ? { email: identity.toLowerCase() }
    : { phone: identity };

  const user = await User.findOne(lookup).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid email/phone or password.', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError('Invalid email/phone or password.', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  return {
    user: toSafeUser(user),
    token: signAuthToken(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User account no longer exists.', {
      statusCode: 401,
      code: 'AUTH_USER_NOT_FOUND',
    });
  }

  return toSafeUser(user);
}

export async function requestPhoneOtp(userId) {
  if (env.nodeEnv === 'production') {
    throw new AppError('SMS delivery is not configured yet.', {
      statusCode: 503,
      code: 'SMS_PROVIDER_NOT_CONFIGURED',
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User account no longer exists.', {
      statusCode: 401,
      code: 'AUTH_USER_NOT_FOUND',
    });
  }

  if (user.phoneVerified) {
    return { alreadyVerified: true, expiresAt: null };
  }

  const now = Date.now();
  const requestedAt = user.phoneVerification?.requestedAt?.getTime?.() ?? 0;

  if (requestedAt && now - requestedAt < PHONE_OTP_COOLDOWN_MS) {
    throw new AppError('Please wait before requesting another verification code.', {
      statusCode: 429,
      code: 'OTP_REQUEST_TOO_SOON',
    });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(now + PHONE_OTP_TTL_MS);

  user.phoneVerification = {
    otpHash: hashPhoneOtp(user._id.toString(), otp),
    requestedAt: new Date(now),
    expiresAt,
    attempts: 0,
  };
  await user.save();

  const maskedPhone = `${user.phone.slice(0, 3)}******${user.phone.slice(-2)}`;
  console.log(`RouteBite development phone OTP for ${maskedPhone}: ${otp}`);

  return { alreadyVerified: false, expiresAt };
}

export async function verifyPhoneOtp({ userId, otp }) {
  const user = await User.findById(userId).select('+phoneVerification.otpHash');

  if (!user) {
    throw new AppError('User account no longer exists.', {
      statusCode: 401,
      code: 'AUTH_USER_NOT_FOUND',
    });
  }

  if (user.phoneVerified) return toSafeUser(user);

  const verification = user.phoneVerification;

  if (!verification?.otpHash || !verification.expiresAt) {
    throw new AppError('Request a verification code first.', {
      statusCode: 422,
      code: 'OTP_NOT_REQUESTED',
    });
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    throw new AppError('The verification code has expired.', {
      statusCode: 422,
      code: 'OTP_EXPIRED',
    });
  }

  if (verification.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new AppError('Too many incorrect verification attempts.', {
      statusCode: 429,
      code: 'OTP_TOO_MANY_ATTEMPTS',
    });
  }

  const suppliedHash = hashPhoneOtp(user._id.toString(), otp);
  const matches = crypto.timingSafeEqual(
    Buffer.from(suppliedHash, 'hex'),
    Buffer.from(verification.otpHash, 'hex'),
  );

  if (!matches) {
    verification.attempts += 1;
    await user.save();

    throw new AppError('Incorrect verification code.', {
      statusCode: 422,
      code: 'OTP_INVALID',
    });
  }

  user.phoneVerified = true;
  user.phoneVerification = {
    otpHash: null,
    requestedAt: null,
    expiresAt: null,
    attempts: 0,
  };
  await user.save();

  return toSafeUser(user);
}
