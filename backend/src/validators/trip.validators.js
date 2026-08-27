import { body, param } from 'express-validator';
import { PARTNER_OPERATION_LIMITS } from '../constants/partner.constants.js';

function pointValidators(prefix, label) {
  return [
    body(`${prefix}.latitude`)
      .isFloat({ min: -90, max: 90 })
      .withMessage(`${label} latitude must be between -90 and 90.`)
      .toFloat(),
    body(`${prefix}.longitude`)
      .isFloat({ min: -180, max: 180 })
      .withMessage(`${label} longitude must be between -180 and 180.`)
      .toFloat(),
    body(`${prefix}.label`)
      .isString()
      .withMessage(`${label} label is required.`)
      .bail()
      .trim()
      .isLength({ min: 2, max: 180 })
      .withMessage(`${label} label must be between 2 and 180 characters.`),
  ];
}

export const createTripValidators = [
  ...pointValidators('origin', 'Origin'),
  ...pointValidators('destination', 'Destination'),
  body('scheduledDepartureAt')
    .isISO8601({ strict: true })
    .withMessage('Scheduled departure must be a valid ISO timestamp.')
    .toDate(),
  body('departureFlexMinutes')
    .optional()
    .isInt({
      min: 0,
      max: PARTNER_OPERATION_LIMITS.MAX_DEPARTURE_FLEX_MINUTES,
    })
    .withMessage(
      `Departure flexibility must be between 0 and ${PARTNER_OPERATION_LIMITS.MAX_DEPARTURE_FLEX_MINUTES} minutes.`,
    )
    .toInt(),
];

export const tripIdValidators = [
  param('tripId').isMongoId().withMessage('Invalid trip ID.'),
];
