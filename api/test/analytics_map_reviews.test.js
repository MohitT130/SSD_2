// Integration tests for the Analytics (Workflow 2 + materialized view), Map
// (Workflow 3) and Reviews & menus (Workflow 4) endpoints. Like the
// transaction tests, they run against the real seeded PostgreSQL and MongoDB
// databases configured in api/.env.
//
//   cd api && npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { closeConnections, getPgPool } from '../src/db.js';

let server;
let base;

async function api(method, path) {
  const response = await fetch(`${base}${path}`, { method });
  return { status: response.status, body: await response.json() };
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

before(() => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await closeConnections();
});

describe('Analytics: Workflow 2 and the materialized view', () => {
  test('moving average of the last day equals the mean of that day and the 6 before it', async () => {
    const { body: ranks } = await api('GET', '/analytics/rankings?pageSize=1');
    const id = ranks.data[0].restaurant_id;

    const { status, body } = await api('GET', `/analytics/moving-average?restaurantId=${id}`);
    assert.equal(status, 200);
    assert.equal(body.data.length, 30);
    assert.equal(body.restaurant.id, id);

    const last = body.data.at(-1);
    assert.match(last.order_date, /^\d{4}-\d{2}-\d{2}$/);

    const expected = (await getPgPool().query(
      `SELECT ROUND(COALESCE(SUM(total_amount), 0) / 7.0, 2) AS v
       FROM orders
       WHERE restaurant_id = $1 AND status = 'DELIVERED'
         AND created_at::date BETWEEN $2::date - 6 AND $2::date`,
      [id, last.order_date]
    )).rows[0].v;
    assert.equal(Number(last.moving_average_7_day), Number(expected));
  });

  test('moving average rejects a malformed id (400) and an unknown restaurant (404)', async () => {
    const missing = await api('GET', '/analytics/moving-average');
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, 'INVALID_ID');

    const malformed = await api('GET', '/analytics/moving-average?restaurantId=abc');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_ID');

    const unknown = await api('GET', `/analytics/moving-average?restaurantId=${UNKNOWN_UUID}`);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.code, 'RESTAURANT_NOT_FOUND');
  });

  test('rankings are paginated and DENSE_RANK never decreases', async () => {
    const { status, body } = await api('GET', '/analytics/rankings?page=2&pageSize=25');
    assert.equal(status, 200);
    assert.equal(body.data.length, 25);
    assert.equal(body.page, 2);
    assert.equal(body.total, 500);
    const ranks = body.data.map((row) => Number(row.revenue_rank));
    assert.ok(ranks.every((rank, i) => i === 0 || ranks[i - 1] <= rank));
  });

  test('refresh moves refreshed_at forward and reports its duration', async () => {
    const before = (await api('GET', '/analytics/summary')).body.data.refreshed_at;
    assert.ok(before, 'summary must expose refreshed_at');

    const { status, body } = await api('POST', '/analytics/refresh');
    assert.equal(status, 200);
    assert.ok(Date.parse(body.data.refreshed_at) > Date.parse(before));
    assert.ok(Number.isFinite(body.data.duration_ms));

    const after = (await api('GET', '/analytics/summary')).body.data.refreshed_at;
    assert.equal(Date.parse(after), Date.parse(body.data.refreshed_at));
  });
});
