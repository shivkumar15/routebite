import { body, param } from 'express-validator';
import { DELIVERY_TYPE } from '../constants/order.constants.js';

const locationValidators = (field, label) => [
  body(`${field}.label`)
    .isString()
    .withMessage(`${label} label is required.`)
    .bail()
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage(`${label} label must be between 2 and 180 characters.`),
  body(`${field}.latitude`)
    .isFloat({ min: -90, max: 90 })
    .withMessage(`${label} latitude must be between -90 and 90.`)
    .toFloat(),
  body(`${field}.longitude`)
    .isFloat({ min: -180, max: 180 })
    .withMessage(`${label} longitude must be between -180 and 180.`)
    .toFloat(),
];

export const orderIdValidators = [
  param('orderId').isMongoId().withMessage('Invalid order ID.'),
];

export const orderDraftValidators = [
  body('status')
    .not()
    .exists()
    .withMessage('Order status cannot be set through the draft API.'),
  body('vendorDisplayName')
    .isString()
    .withMessage('Vendor name is required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Vendor name must be between 2 and 120 characters.'),
  body('requestedItems')
    .isString()
    .withMessage('Requested items are required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 2000 })
    .withMessage('Requested items must be between 2 and 2000 characters.'),
  body('pickupInstructions')
    .optional({ nullable: true })
    .isString()
    .withMessage('Pickup instructions must be text.')
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Pickup instructions must be 500 characters or fewer.'),
  ...locationValidators('pickup', 'Pickup'),
  ...locationValidators('drop', 'Drop'),
  body('deliveryType')
    .isIn(Object.values(DELIVERY_TYPE))
    .withMessage('Delivery type must be ASAP or SCHEDULED.'),
  body('deliveryWindowStart')
    .if(body('deliveryType').equals(DELIVERY_TYPE.SCHEDULED))
    .isISO8601()
    .withMessage('Scheduled delivery start time is required.'),
  body('deliveryWindowEnd')
    .if(body('deliveryType').equals(DELIVERY_TYPE.SCHEDULED))
    .isISO8601()
    .withMessage('Scheduled delivery end time is required.'),
  body('estimatedFoodCostPaise')
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Estimated food cost must be a non-negative integer number of paise.')
    .toInt(),
];
