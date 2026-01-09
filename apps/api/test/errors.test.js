/**
 * Vertragstests für Fehlerbehandlung.
 *
 * Validiert:
 * - 404 für unbekannte Routen im kanonischen Fehlerformat
 * - 400 für Validierungsfehler
 * - keine Stacktrace-Leaks bei ungültigem JSON
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('Fehlerbehandlung', () => {
  it('liefert 404 für unbekannte Route (inkl. requestId Header)', async () => {
    const app = createApp();
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('NOT_FOUND');
    expect(typeof res.body?.error?.message).toBe('string');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('liefert 400 bei ungültigem Body (Validation failed)', async () => {
    const app = createApp();
    const res = await request(app).post('/echo').send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    expect(res.body?.error?.message).toBe('Validation failed');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('leakt keinen Stacktrace bei ungültigem JSON', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"message": "ok"'); // kaputtes JSON

    expect([400, 500]).toContain(res.status);
    expect(res.body?.stack).toBeUndefined();
    expect(res.body?.error?.requestId).toBeTruthy();
  });
});
