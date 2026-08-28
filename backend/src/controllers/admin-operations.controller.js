import {
  getAdminOrderDetail,
  listAdminOrders,
} from '../services/admin-operations.service.js';

export async function orders(req, res, next) {
  try {
    const result = await listAdminOrders({ filter: req.query.filter });
    res.status(200).json({ success: true, data: result });
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
