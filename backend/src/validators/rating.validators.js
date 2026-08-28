import { body } from 'express-validator';

export const ratingValidators = [
  body('score')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating score must be an integer from 1 to 5.')
    .toInt(),
  body('feedback')
    .optional({ nullable: true })
    .isString()
    .withMessage('Rating feedback must be text.')
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rating feedback must be 500 characters or fewer.'),
];
