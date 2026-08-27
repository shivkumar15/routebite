import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { USER_ROLES, AUTH_TOKEN_TTL } from '../constants/auth.constants.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const BCRYPT_ROUNDS = 12;

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
