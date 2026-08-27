import { body, param } from 'express-validator';
import { PARTNER_AVAILABILITY_STATUS } from '../constants/partner.constants.js';

export const partnerApplicationValidators = [
  body('profilePhotoAssetId')
    .isMongoId()
    .withMessage('A valid profile photo asset is required.'),
  body('collegeIdAssetId')
    .isMongoId()
    .withMessage('A valid college ID asset is required.'),
  body('collegeName')
    .isString()
    .withMessage('College name is required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('College name must be between 2 and 120 characters.'),
  body('enrollmentNumber')
    .isString()
    .withMessage('Enrollment number is required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Enrollment number must be between 2 and 80 characters.'),
];

export const partnerAvailabilityValidators = [
  body('status')
    .isIn(Object.values(PARTNER_AVAILABILITY_STATUS))
    .withMessage('Availability status must be OFFLINE or AVAILABLE_NOW.'),
];

export const partnerLocationValidators = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90.')
    .toFloat(),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180.')
    .toFloat(),
  body('accuracyMeters')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Location accuracy must be between 0 and 10000 meters.')
    .toFloat(),
];

export const partnerIdValidators = [
  param('partnerId').isMongoId().withMessage('Invalid partner ID.'),
];

export const rejectPartnerValidators = [
  ...partnerIdValidators,
  body('reason')
    .isString()
    .withMessage('A rejection reason is required.')
    .bail()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Rejection reason must be between 3 and 500 characters.'),
];
