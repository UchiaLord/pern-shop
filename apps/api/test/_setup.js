import 'dotenv/config';

import { beforeEach } from 'vitest';

import { pool } from '../src/db/pool.js';

beforeEach(async () => {
  await pool.query(`
    TRUNCATE
      order_items,
      orders,
      products,
      users
    RESTART IDENTITY CASCADE;
  `);
});