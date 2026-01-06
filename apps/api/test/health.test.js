/**
 * Integrationstests für Basis-Endpunkte.
 *
 * Ziel:
 * - Sicherstellen, dass die App ohne Serverstart testbar ist
 * - Vertrag des Health-Endpunkts prüfen
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('GET /health', () => {
  it('liefert 200 mit status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
