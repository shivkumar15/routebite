import { body, param } from 'express-validator';

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
