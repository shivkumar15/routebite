import {
  getAdminOrderDetail,
  listAdminOrders,
} from '../services/admin-operations.service.js';
import { attachAdminOrderStopReasons } from '../services/admin-order-stop-reason.service.js';

export async function orders(req, res, next) {
  try {
    const result = await listAdminOrders({ filter: req.query.filter });
    const enriched = await attachAdminOrderStopReasons(result);
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
}

export async function orderDetail(req, res, next) {
  try {
    const detail = await getAdminOrderDetail(req.params.orderId);
    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    next(error);
  }
}
