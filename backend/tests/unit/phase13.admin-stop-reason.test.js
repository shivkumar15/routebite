import { ORDER_STATUS } from '../../src/constants/order.constants.js';
import { buildAdminStopReason } from '../../src/services/admin-order-stop-reason.service.js';

describe('Phase 13 admin stop reason projection', () => {
  test('uses recovery reason for customer cancellation', () => {
    const reason = buildAdminStopReason({
      order: {
        status: ORDER_STATUS.CANCELLED,
        recovery: {
          lastEvent: 'CUSTOMER_CANCELLED_BEFORE_PURCHASE',
          reason: 'Customer changed their mind.',
        },
      },
    });

    expect(reason).toEqual({
      kind: 'CANCELLATION',
      title: 'Cancellation reason',
      reason: 'Customer changed their mind.',
      detail: 'CUSTOMER_CANCELLED_BEFORE_PURCHASE',
    });
  });

  test('shows hard-filter summary for matching failure', () => {
    const reason = buildAdminStopReason({
      order: { status: ORDER_STATUS.MATCHING_FAILED, recovery: {} },
      latestAttempt: {
        failureReason: 'No eligible partner can satisfy this request right now.',
        rejectionSummary: {
          PICKUP_TOO_FAR: 2,
          DELIVERY_WINDOW_MISSED: 1,
        },
      },
      offers: [],
    });

    expect(reason.title).toBe('Why matching failed');
    expect(reason.reason).toBe('No eligible partner can satisfy this request right now.');
    expect(reason.detail).toBe('DELIVERY_WINDOW_MISSED × 1 · PICKUP_TOO_FAR × 2');
  });

  test('explains when every dispatched offer expired', () => {
    const reason = buildAdminStopReason({
      order: { status: ORDER_STATUS.MATCHING_FAILED, recovery: {} },
      latestAttempt: { rejectionSummary: {} },
      offers: [{ status: 'EXPIRED' }],
    });

    expect(reason.reason).toContain('expired before acceptance');
  });

  test('does not create a stop reason for an active order', () => {
    const reason = buildAdminStopReason({
      order: { status: ORDER_STATUS.MATCHING, recovery: {} },
    });

    expect(reason).toBeNull();
  });
});
