import { param } from 'express-validator';

export const offerIdValidators = [
  param('offerId').isMongoId().withMessage('offerId must be a valid identifier.'),
];
