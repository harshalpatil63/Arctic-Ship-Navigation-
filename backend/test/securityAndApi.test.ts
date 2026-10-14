import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import http from 'node:http';

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        return reject(new Error('Failed to bind ephemeral server'));
      }

      const reqHeaders: Record<string, string> = { ...headers };
      let payload = '';
      if (body) {
        payload = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close();
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
            } catch {
              resolve({ status: res.statusCode || 500, headers: res.headers, body: { raw: data } });
            }
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe('API Contracts & Security Controls', () => {
  it('serves health status with ok and live mode', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.mode, 'LIVE');
  });

  it('honestly returns 503 UNAVAILABLE when live AIS or iceberg feeds are unconfigured', async () => {
    const shipsRes = await makeRequest('GET', '/api/ships');
    assert.equal(shipsRes.status, 503);
    assert.equal(shipsRes.body.status, 'UNAVAILABLE');

    const icebergsRes = await makeRequest('GET', '/api/icebergs');
    assert.equal(icebergsRes.status, 503);
    assert.equal(icebergsRes.body.status, 'UNAVAILABLE');
  });

  it('validates weather query coordinates and rejects out-of-range coordinates', async () => {
    const res = await makeRequest('GET', '/api/weather?latitude=105&longitude=30');
    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'INVALID_REQUEST');
  });

  it('rejects route generation when departure and arrival ports are identical', async () => {
    const res = await makeRequest('POST', '/api/routes/generate', {
      departureId: 'p1',
      arrivalId: 'p1',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'INVALID_REQUEST');
  });

  it('returns security headers set by helmet', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.ok(
      res.headers['x-content-type-options'] === 'nosniff',
      'X-Content-Type-Options must be nosniff'
    );
  });
});
