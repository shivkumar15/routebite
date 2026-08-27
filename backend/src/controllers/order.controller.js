import {
  createDraftOrder,
  getCustomerOrder,
  listCustomerOrders,
  updateDraftOrder,
} from '../services/order.service.js';

export async function create(req, res, next) {
  try {
    const order = await createDraftOrder({
      customerId: req.auth.userId,
      payload: req.body,
    });

    res.status(201).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const orders = await listCustomerOrders(req.auth.userId);
    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const order = await getCustomerOrder({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const order = await updateDraftOrder({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      payload: req.body,
    });
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}
