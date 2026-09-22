import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { registerSocketEvents } from './websocket/socket.js';

const port = Number(process.env.PORT || 4000);
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' } });
registerSocketEvents(io);

connectDatabase()
  .then(() => httpServer.listen(port, () => console.log(`Arctic navigation backend listening on ${port}`)))
  .catch((error) => { console.error('Database connection failed', error); process.exitCode = 1; });
