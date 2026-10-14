export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} must be a valid id.`);
  }
  return value;
}

/**
 * Translate PostgreSQL errors raised by the inherited procedures, constraints
 * and the partial unique index into friendly API errors. Unknown errors are
 * returned unchanged (they become a 500).
 */
export function fromPgError(error) {
  const constraint = error.constraint;

  switch (error.code) {
    case '22023': // invalid_parameter_value, raised by sp_execute_checkout
      return new ApiError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');

    case 'P0001':
      if (/insufficient wallet balance/i.test(error.message)) {
        return new ApiError(422, 'INSUFFICIENT_BALANCE', 'There is not enough money in the wallet for this order. Nothing was charged.');
      }
      return error;

    case '23514': // check_violation not handled inside the procedure
      if (constraint === 'chk_wallet_balance') {
        return new ApiError(422, 'INSUFFICIENT_BALANCE', 'There is not enough money in the wallet for this order. Nothing was charged.');
      }
      return error;

    case '23505': // unique_violation
      if (constraint === 'idx_active_user_order') {
        return new ApiError(409, 'ACTIVE_ORDER_EXISTS',
          'This customer already has an order that is being prepared or delivered. Only one active order is allowed at a time; it must be delivered before a new order can be placed.');
      }
      return error;

    case '23503': // foreign_key_violation
      if (constraint === 'fk_orders_restaurant') {
        return new ApiError(404, 'RESTAURANT_NOT_FOUND', 'That restaurant does not exist.');
      }
      if (constraint === 'fk_orders_user') {
        return new ApiError(404, 'USER_NOT_FOUND', 'That customer does not exist.');
      }
      return error;

    case 'P0002': // no_data_found
      if (/order/i.test(error.message)) {
        return new ApiError(404, 'ORDER_NOT_FOUND', 'That order does not exist.');
      }
      return new ApiError(404, 'USER_NOT_FOUND', 'That customer does not exist.');

    case '55000': // object_not_in_prerequisite_state, raised by sp_advance_order_status
      return new ApiError(409, 'ORDER_ALREADY_DELIVERED', 'This order is already delivered; there is no next status.');

    case '22P02': // invalid_text_representation (e.g. malformed uuid)
      return new ApiError(400, 'INVALID_ID', 'One of the ids is not valid.');

    default:
      return error;
  }
}
