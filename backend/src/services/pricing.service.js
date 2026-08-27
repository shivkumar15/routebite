import {
  DEFAULT_CUSTOMER_DELIVERY_CHARGE_PAISE,
  DEFAULT_PARTNER_BASE_EARNING_PAISE,
  DEFAULT_PLATFORM_FEE_PAISE,
} from '../constants/payment.constants.js';
import { AppError } from '../utils/app-error.js';

export function calculateCheckoutPricing(estimatedFoodCostPaise) {
  if (!Number.isSafeInteger(estimatedFoodCostPaise) || estimatedFoodCostPaise < 0) {
    throw new AppError('Estimated food cost must be a non-negative integer number of paise.', {
      statusCode: 422,
      code: 'INVALID_ESTIMATED_FOOD_COST',
    });
  }

  const customerDeliveryChargePaise = DEFAULT_CUSTOMER_DELIVERY_CHARGE_PAISE;
  const partnerBaseEarningPaise = DEFAULT_PARTNER_BASE_EARNING_PAISE;
  const platformFeePaise = DEFAULT_PLATFORM_FEE_PAISE;
  const estimatedCustomerTotalPaise =
    estimatedFoodCostPaise + customerDeliveryChargePaise + platformFeePaise;

  return {
    estimatedFoodCostPaise,
    customerDeliveryChargePaise,
    partnerBaseEarningPaise,
    platformFeePaise,
    estimatedCustomerTotalPaise,
  };
}
