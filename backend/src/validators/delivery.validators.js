import { body } from 'express-validator';

export const actualFoodPriceValidators = [
  body('actualFoodCostPaise')
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Actual food price must be integer paise.'),
  body('receiptAssetId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Receipt asset id is invalid.'),
];
