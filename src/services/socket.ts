import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export interface ConnectionStatus {
  connected: boolean;
  source: 'LIVE' | 'UNAVAILABLE';
}

export function createNavigationSocket(onStatus: (status: ConnectionStatus) => void): Socket {
  const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket'] });
  socket.on('connect', () => onStatus({ connected: true, source: 'LIVE' }));
  socket.on('disconnect', () => onStatus({ connected: false, source: 'UNAVAILABLE' }));
  socket.on('connection:status', onStatus);
  socket.connect();
  return socket;
}