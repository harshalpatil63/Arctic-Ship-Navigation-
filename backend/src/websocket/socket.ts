import { Server } from 'socket.io';

export function registerSocketEvents(io: Server): void {
  io.on('connection', (socket) => {
    socket.emit('connection:status', { connected: true, source: 'LIVE' });
    socket.on('voyage:subscribe', (voyageId: string) => socket.join(`voyage:${voyageId}`));
  });
}

export function emitDataUpdate(io: Server, event: string, payload: unknown): void {
  io.emit(event, payload);
}
