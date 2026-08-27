import { body } from 'express-validator';
import { UPLOAD_PURPOSE } from '../constants/partner.constants.js';

export const uploadValidators = [
  body('purpose')
    .isIn(Object.values(UPLOAD_PURPOSE))
    .withMessage('Choose a supported upload purpose.'),
];
