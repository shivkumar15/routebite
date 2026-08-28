import {
  getCustomerDemoLedger,
  getPartnerEarnings,
} from '../services/accounting.service.js';

export async function customerDemoLedger(req, res, next) {
  try {
    const ledger = await getCustomerDemoLedger({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: { ledger } });
  } catch (error) {
    next(error);
  }
}

export async function partnerEarnings(req, res, next) {
  try {
    const result = await getPartnerEarnings(req.auth.partnerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
