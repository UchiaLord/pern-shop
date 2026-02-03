import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

const app = createApp();

describe('Auth (Session-basiert)', () => {
  beforeEach(async () => {
    // FK-sichere Cleanup-Reihenfolge:
    // order_items -> orders -> products -> users
    // (auth tests erstellen evtl. indirekt users, andere Tests erstellen orders)
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query(`DELETE FROM products WHERE sku LIKE 'test-%'`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'test+%@example.com'`);
  });

  it('POST /auth/register -> 201 + user + Set-Cookie', async () => {
    const agent = request.agent(app);

    const res = await agent.post('/auth/register').send({
      email: 'test+register@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    expect(res.status).toBe(201);
    expect(res.body?.user?.email).toBe('test+register@example.com');
    expect(res.headers['set-cookie']).toBeTruthy();
  });

  it('POST /auth/register doppelt -> 409 EMAIL_TAKEN', async () => {
    const agent = request.agent(app);

    const body = {
      email: 'test+dup@example.com',
      password: 'SehrSicheresPasswort123!',
    };

    const first = await agent.post('/auth/register').send(body);
    expect(first.status).toBe(201);

    const second = await agent.post('/auth/register').send(body);
    expect(second.status).toBe(409);
    expect(second.body?.error?.code).toBe('EMAIL_TAKEN');
  });

  it('POST /auth/login -> 200 und /auth/me -> 200 (Session bleibt erhalten)', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/register').send({
      email: 'test+login@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    // Logout, um login test „realistisch“ zu machen
    await agent.post('/auth/logout').send();

    const login = await agent.post('/auth/login').send({
      email: 'test+login@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    expect(login.status).toBe(200);
    expect(login.body?.user?.email).toBe('test+login@example.com');

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body?.user?.email).toBe('test+login@example.com');
  });

  it('POST /auth/login falsches Passwort -> 401 INVALID_CREDENTIALS', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/register').send({
      email: 'test+badpw@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const res = await agent.post('/auth/login').send({
      email: 'test+badpw@example.com',
      password: 'FALSCHES_PASSWORT_123!',
    });

    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/logout -> 204 und /auth/me danach -> 401', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/register').send({
      email: 'test+logout@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const logout = await agent.post('/auth/logout');
    expect(logout.status).toBe(204);

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(401);
    expect(me.body?.error?.code).toBe('UNAUTHENTICATED');
  });

  it('RBAC: admin-only -> 401 ohne Login, 403 als user, 200 als admin', async () => {
    const agent = request.agent(app);

    // 401 ohne Login
    const noLogin = await agent.get('/__test__/admin-only');
    expect(noLogin.status).toBe(401);

    // Register (default role: user) -> 403
    await agent.post('/auth/register').send({
      email: 'test+rbac@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const asUser = await agent.get('/__test__/admin-only');
    expect(asUser.status).toBe(403);

    // Rolle im Test direkt in der Session setzen:
    const setRole = await agent.post('/__test__/set-role').send({ role: 'admin' });
    expect(setRole.status).toBe(200);

    const asAdmin = await agent.get('/__test__/admin-only');
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body?.ok).toBe(true);
  });
});