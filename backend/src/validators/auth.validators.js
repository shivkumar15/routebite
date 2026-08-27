import { body } from 'express-validator';

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export const registerValidators = [
  body('name')
    .isString()
    .withMessage('Name is required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters.'),
  body('email')
    .isString()
    .withMessage('Email is required.')
    .bail()
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .customSanitizer((value) => value.toLowerCase()),
  body('phone')
    .isString()
    .withMessage('Phone is required.')
    .bail()
    .trim()
    .matches(E164_PHONE)
    .withMessage('Use phone format like +919876543210.'),
  body('password')
    .isString()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters.'),
];

export const loginValidators = [
  body('emailOrPhone')
    .isString()
    .withMessage('Email or phone is required.')
    .bail()
    .trim()
    .isLength({ min: 3, max: 254 })
    .withMessage('Enter a valid email or phone.'),
  body('password')
    .isString()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 1, max: 128 })
    .withMessage('Password is required.'),
];

export const otpValidators = [
  body('otp')
    .isString()
    .withMessage('Verification code is required.')
    .bail()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Verification code must contain exactly 6 digits.'),
];

export const phoneOtpValidators = otpValidators;
export const emailOtpValidators = otpValidators;
