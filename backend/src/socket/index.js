import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants.js';
import { PARTNER_VERIFICATION_STATUS } from '../constants/partner.constants.js';
import { env } from '../config/env.js';
import { Partner } from '../models/partner.model.js';
import { User } from '../models/user.model.js';

let ioInstance = null;

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

async function resolveSocketAuth(socket) {
  const token = readCookie(socket.handshake.headers.cookie, AUTH_COOKIE_NAME);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select('_id role tokenVersion');
    if (!user || user.tokenVersion !== payload.tokenVersion) return null;

    const partner = await Partner.findOne({
      userId: user._id,
      verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
    }).select('_id');

    return {
      userId: user._id.toString(),
      role: user.role,
      partnerId: partner?._id.toString() ?? null,
    };
  } catch {
    return null;
  }
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.auth = await resolveSocketAuth(socket);
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth;
    if (auth?.userId) socket.join(`user:${auth.userId}`);
    if (auth?.partnerId) socket.join(`partner:${auth.partnerId}`);

    socket.emit('system:connected', {
      connectedAt: new Date().toISOString(),
      authenticated: Boolean(auth?.userId),
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketServer() {
  return ioInstance;
}
