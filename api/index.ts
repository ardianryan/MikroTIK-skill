import type { IncomingMessage, ServerResponse } from 'node:http';
import { MikroTikHttpServer } from '../src/server/http.js';

const server = new MikroTikHttpServer();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await server.handleRequest(req, res);
}
