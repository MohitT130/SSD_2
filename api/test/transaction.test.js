// Integration tests for Workflow 1 (place order), order status changes,
// browsing and the audit trail. They run against the real seeded PostgreSQL
// database configured in api/.env, because the behaviour under test lives in
// the database (stored procedure, CHECK constraint, partial unique index,
// trigger).
//
//   cd api && npm test
//
// Note: the tests place real orders for one customer (and deliver them).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { closeConnections, getPgPool } from '../src/db.js';

let server;
let base;
let customer; // a customer with no active order and some money
let restaurantId;

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function walletOf(userId) {
  const result = await getPgPool().query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
  return result.rows[0].wallet_balance;
}

async function auditCount(userId) {
  const result = await getPgPool().query('SELECT count(*)::int AS n FROM wallet_audit_logs WHERE user_id = $1', [userId]);
  return result.rows[0].n;
}

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;

  const pool = getPgPool();
  customer = (await pool.query(`
    SELECT u.id, u.wallet_balance FROM users u
    WHERE u.wallet_balance BETWEEN 1000 AND 50000
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status IN ('PREPARING','DELIVERING'))
    ORDER BY u.id LIMIT 1`)).rows[0];
  restaurantId = (await pool.query('SELECT id FROM restaurants ORDER BY id LIMIT 1')).rows[0].id;

  assert.ok(customer, 'seed data must contain a customer without an active order');
});

after(async () => {
  server.close();
  await closeConnections();
});

describe('Workflow 1: place order', () => {
  test('success debits the wallet and the trigger writes a DEBIT audit row', async () => {
    const balance = Number(await walletOf(customer.id));
    const { status, body } = await api('POST', '/checkout', { userId: customer.id, restaurantId, amount: 250.5 });

    assert.equal(status, 201);
    assert.equal(Number(body.data.balanceBefore), balance);
    assert.equal(Number(body.data.balanceAfter), Number((balance - 250.5).toFixed(2)));
    assert.equal(body.data.order.status, 'PREPARING');
    assert.equal(body.data.auditEntry.action_type, 'DEBIT');
    assert.equal(body.data.auditEntry.amount_changed, '250.50');
    assert.equal(body.data.auditEntry.balance_after, body.data.balanceAfter);
  });

  test('a second order while one is active is blocked by the partial unique index', async () => {
    const balance = await walletOf(customer.id);
    const audits = await auditCount(customer.id);

    const { status, body } = await api('POST', '/checkout', { userId: customer.id, restaurantId, amount: 100 });

    assert.equal(status, 409);
    assert.equal(body.code, 'ACTIVE_ORDER_EXISTS');
    assert.match(body.error, /only one active order/i);
    assert.equal(await walletOf(customer.id), balance, 'wallet must be unchanged');
    assert.equal(await auditCount(customer.id), audits, 'no audit row on failure');
  });

  test('after the active order is delivered, a new order is accepted', async () => {
    const orderId = (await api('GET', `/users/${customer.id}`)).body.data.active_order.id;

    const first = await api('PATCH', `/orders/${orderId}/advance`);
    assert.deepEqual([first.status, first.body.data.previous_status, first.body.data.status], [200, 'PREPARING', 'DELIVERING']);

    const second = await api('PATCH', `/orders/${orderId}/advance`);
    assert.equal(second.body.data.status, 'DELIVERED');

    const third = await api('PATCH', `/orders/${orderId}/advance`);
    assert.equal(third.status, 409);
    assert.equal(third.body.code, 'ORDER_ALREADY_DELIVERED');

    const retry = await api('POST', '/checkout', { userId: customer.id, restaurantId, amount: 100 });
    assert.equal(retry.status, 201);

    // Leave the customer without an active order for the next tests/runs.
    const newOrderId = retry.body.data.order.id;
    await api('PATCH', `/orders/${newOrderId}/advance`);
    await api('PATCH', `/orders/${newOrderId}/advance`);
  });

  test('insufficient balance is rejected with a friendly message and nothing is charged', async () => {
    const balance = await walletOf(customer.id);
    const audits = await auditCount(customer.id);

    const { status, body } = await api('POST', '/checkout', {
      userId: customer.id, restaurantId, amount: Number(balance) + 1,
    });

    assert.equal(status, 422);
    assert.equal(body.code, 'INSUFFICIENT_BALANCE');
    assert.match(body.error, /Nothing was charged/);
    assert.equal(body.balanceAfter, balance);
    assert.equal(await walletOf(customer.id), balance);
    assert.equal(await auditCount(customer.id), audits);
  });

  test('zero, negative and malformed amounts are rejected (negative used to credit the wallet)', async () => {
    const balance = await walletOf(customer.id);

    for (const amount of [0, -1000, 'abc', 10.123]) {
      const { status, body } = await api('POST', '/checkout', { userId: customer.id, restaurantId, amount });
      assert.equal(status, 400, `amount ${amount}`);
      assert.equal(body.code, 'INVALID_AMOUNT');
    }

    assert.equal(await walletOf(customer.id), balance);
  });

  test('the procedure itself rejects a negative amount (defence in depth)', async () => {
    await assert.rejects(
      getPgPool().query('CALL sp_execute_checkout($1, $2, $3)', [customer.id, restaurantId, -1000]),
      (error) => error.code === '22023'
    );
  });

  test('unknown restaurant and customer give 404s', async () => {
    const zero = '00000000-0000-0000-0000-000000000000';

    const r = await api('POST', '/checkout', { userId: customer.id, restaurantId: zero, amount: 5 });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, 'RESTAURANT_NOT_FOUND');

    const u = await api('POST', '/checkout', { userId: zero, restaurantId, amount: 5 });
    assert.equal(u.status, 404);
    assert.equal(u.body.code, 'USER_NOT_FOUND');
  });
});

describe('Browse', () => {
  test('lists are paginated on the server', async () => {
    const { status, body } = await api('GET', '/orders?page=3&pageSize=20');

    assert.equal(status, 200);
    assert.equal(body.data.length, 20);
    assert.equal(body.page, 3);
    assert.ok(body.total >= 50000);
  });

  test('page size is capped at 100', async () => {
    const { body } = await api('GET', '/users?pageSize=100000');
    assert.equal(body.data.length, 100);
  });

  test('search and filters narrow the results', async () => {
    const { body } = await api('GET', '/users?search=maya&hasActiveOrder=false&pageSize=50');
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every((u) => /maya/i.test(u.name) && u.has_active_order === false));
  });
});

describe('Audit trail', () => {
  test('running balance (window function) matches balance_after from the trigger', async () => {
    const { status, body } = await api('GET', `/users/${customer.id}/audit?pageSize=100`);

    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
    for (const row of body.data) {
      assert.equal(row.running_balance, row.balance_after);
    }
    assert.equal(body.summary.closing_balance, await walletOf(customer.id));
  });

  test('date filter only returns entries inside the range', async () => {
    // The orders placed by the tests above happened within the last hour.
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();
    const { body } = await api('GET', `/users/${customer.id}/audit?from=${from}&to=${to}`);

    assert.ok(body.data.length >= 3, 'the three orders placed above are in range');
    for (const row of body.data) {
      const at = Date.parse(row.timestamp);
      assert.ok(at >= Date.parse(from) && at < Date.parse(to));
    }
    assert.equal(Number(body.summary.total_debits) > 0, true);
  });

  test('date-only bounds include the whole "to" day', async () => {
    const { body: all } = await api('GET', `/users/${customer.id}/audit?pageSize=100`);
    const oldest = all.data.at(-1).timestamp.slice(0, 10);
    const { body } = await api('GET', `/users/${customer.id}/audit?from=2000-01-01&to=2100-12-31&pageSize=100`);

    assert.equal(body.total, all.total);
    assert.ok(oldest >= '2000-01-01');
  });

  test('an inverted date range is rejected', async () => {
    const { status, body } = await api('GET', `/users/${customer.id}/audit?from=2026-10-10&to=2026-10-01`);
    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_DATE_RANGE');
  });
});
