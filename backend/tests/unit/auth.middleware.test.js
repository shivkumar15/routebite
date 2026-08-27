import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { requireApprovedPartner } = await import('../../src/middleware/auth.middleware.js');

describe('requireApprovedPartner', () => {
  test('rejects an administrator before partner lookup', async () => {
    const req = {
      auth: {
        userId: '507f1f77bcf86cd799439011',
        role: 'ADMIN',
      },
    };
    const next = jest.fn();

    await requireApprovedPartner(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.code).toBe('ADMIN_PARTNER_CONFLICT');
    expect(error.statusCode).toBe(403);
  });
});
