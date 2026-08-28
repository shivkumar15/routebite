import { body } from 'express-validator';

export const recoveryReasonValidators = [
  body('reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Recovery reason must be at most 500 characters.'),
];
