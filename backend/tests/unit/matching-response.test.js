process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { toCustomerMatchingSummary } = await import(
  '../../src/services/matching-response.service.js'
);

describe('Phase 6 customer matching response', () => {
  test('does not expose pre-assignment partner ids', () => {
    const summary = toCustomerMatchingSummary({
      id: 'attempt-1',
      attemptNumber: 1,
      status: 'CANDIDATES_READY',
      resumeAt: null,
      routeSource: 'DEV_APPROXIMATION',
      discoveredCandidateCount: 2,
      eligibleCandidateCount: 1,
      offerReadyPartnerIds: ['partner-secret-id'],
      candidates: [
        {
          partnerId: 'partner-secret-id',
          tripId: 'trip-secret-id',
          mode: 'AVAILABLE_NOW',
          routeSource: 'DEV_APPROXIMATION',
          predictedPickupAt: new Date('2026-08-27T17:00:00.000Z'),
          predictedDeliveryAt: new Date('2026-08-27T17:20:00.000Z'),
          rankPosition: 1,
        },
      ],
      rejectionSummary: {},
      failureReason: null,
      completedAt: new Date('2026-08-27T16:58:00.000Z'),
    });

    expect(summary.offerReadyCount).toBe(1);
    expect(summary.candidateModes[0].mode).toBe('AVAILABLE_NOW');
    expect(JSON.stringify(summary)).not.toContain('partner-secret-id');
    expect(JSON.stringify(summary)).not.toContain('trip-secret-id');
  });
});
