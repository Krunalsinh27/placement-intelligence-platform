import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns HTTP 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('returns status "ok"', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.status).toBe('ok');
  });

  it('returns the expected service name', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.service).toBe('placement-platform-api');
  });

  it('returns a version string', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(typeof res.body.version).toBe('string');
  });

  it('returns meta with a requestId and timestamp', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(typeof res.body.meta.requestId).toBe('string');
    expect(typeof res.body.meta.timestamp).toBe('string');
  });

  it('returns database status in health response', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(['connected', 'disconnected', 'connecting', 'disconnecting']).toContain(
      res.body.database
    );
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
