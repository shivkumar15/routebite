import { Rating } from '../../src/models/rating.model.js';
import { ratingAverageAfter } from '../../src/services/rating.service.js';

describe('Phase 14 ratings', () => {
  test('first rating becomes the partner average', () => {
    expect(
      ratingAverageAfter({ currentAverage: 0, currentCount: 0, score: 5 }),
    ).toBe(5);
  });

  test('later ratings use a simple running average', () => {
    expect(
      ratingAverageAfter({ currentAverage: 4, currentCount: 2, score: 2 }),
    ).toBeCloseTo(10 / 3);
  });

  test('invalid rating scores are rejected by aggregate helper', () => {
    expect(
      ratingAverageAfter({ currentAverage: 4, currentCount: 2, score: 6 }),
    ).toBeNull();
  });

  test('rating schema allows only one rating document per order', () => {
    const orderIndex = Rating.schema.indexes().find(
      ([fields]) => fields.orderId === 1 && Object.keys(fields).length === 1,
    );

    expect(orderIndex).toBeDefined();
    expect(orderIndex[1].unique).toBe(true);
  });

  test('score must be an integer from 1 to 5 and feedback is capped', async () => {
    const invalid = new Rating({
      orderId: '507f1f77bcf86cd799439011',
      customerId: '507f1f77bcf86cd799439012',
      partnerId: '507f1f77bcf86cd799439013',
      score: 4.5,
      feedback: 'x'.repeat(501),
    });

    const error = await invalid.validate().catch((validationError) => validationError);
    expect(error.errors.score).toBeDefined();
    expect(error.errors.feedback).toBeDefined();
  });
});
