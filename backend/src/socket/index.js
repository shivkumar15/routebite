import { Server } from 'socket.io';
import { env } from '../config/env.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.emit('system:connected', {
      connectedAt: new Date().toISOString(),
    });
  });

  return io;
}
