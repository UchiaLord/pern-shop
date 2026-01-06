import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('Security Baseline', () => {
  it('setzt Security Header (Helmet)', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    // Ein typischer Helmet Header:
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('setzt CORS Header für erlaubten Origin', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    // Wenn origin erlaubt ist, spiegelt CORS den Origin zurück:
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('blockt CORS für nicht erlaubten Origin', async () => {
    const app = createApp();
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');

    // Wenn CORS blockt, sollte kein allow-origin gesetzt sein
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
