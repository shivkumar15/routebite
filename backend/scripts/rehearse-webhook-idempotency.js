import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';

const CONFIRM_FLAG = '--confirm-dev-db';
const REHEARSAL_WEBHOOK_SECRET = 'routebite-phase15-isolated-webhook-secret';

function assertExplicitConfirmation() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Refusing to create rehearsal fixtures without ${CONFIRM_FLAG}.\n` +
        `Run: npm run hardening:webhook-idempotency -- ${CONFIRM_FLAG}`,
    );
    process.exit(2);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run webhook hardening with NODE_ENV=production.');
    process.exit(2);
  }
}

function point(longitude, latitude) {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

async function loadRouteBiteModules() {
  // The rehearsal signs an isolated synthetic webhook. It must not depend on,
  // print, or overwrite a developer's real Razorpay webhook secret.
  process.env.RAZORPAY_WEBHOOK_SECRET = REHEARSAL_WEBHOOK_SECRET;

  const [
    { connectDatabase },
    { env },
    { DELIVERY_TYPE, ORDER_STATUS },
    { PAYMENT_STATUS },
    { MatchingAttempt },
    { Offer },
    { Order },
    { Payment },
    { User },
    { WebhookEvent },
    { handleRazorpayWebhook },
  ] = await Promise.all([
    import('../src/config/db.js'),
    import('../src/config/env.js'),
    import('../src/constants/order.constants.js'),
    import('../src/constants/payment.constants.js'),
    import('../src/models/matching-attempt.model.js'),
    import('../src/models/offer.model.js'),
    import('../src/models/order.model.js'),
    import('../src/models/payment.model.js'),
    import('../src/models/user.model.js'),
    import('../src/models/webhook-event.model.js'),
    import('../src/services/webhook.service.js'),
  ]);

  if (env.razorpay.webhookSecret !== REHEARSAL_WEBHOOK_SECRET) {
    throw new Error('Webhook rehearsal could not install its isolated signing secret.');
  }

  return {
    connectDatabase,
    env,
    DELIVERY_TYPE,
    ORDER_STATUS,
    PAYMENT_STATUS,
    MatchingAttempt,
    Offer,
    Order,
    Payment,
    User,
    WebhookEvent,
    handleRazorpayWebhook,
  };
}

async function main() {
  assertExplicitConfirmation();

  const {
    connectDatabase,
    env,
    DELIVERY_TYPE,
    ORDER_STATUS,
    PAYMENT_STATUS,
    MatchingAttempt,
    Offer,
    Order,
    Payment,
    User,
    WebhookEvent,
    handleRazorpayWebhook,
  } = await loadRouteBiteModules();

  await connectDatabase();

  const tag = `hardening_webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const eventId = `evt_${tag}`;
  const providerOrderId = `order_${tag}`;
  const providerPaymentId = `pay_${tag}`;
  let customerId = null;
  let orderId = null;
  let paymentId = null;

  try {
    const customer = await User.create({
      name: 'Hardening Webhook Customer',
      email: `${tag}@example.test`,
      phone: `+91${String(Date.now()).slice(-10)}`,
      passwordHash: 'hardening-fixture-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    customerId = customer._id;

    const now = new Date();
    const amountPaise = 15000;
    const order = await Order.create({
      customerId: customer._id,
      status: ORDER_STATUS.AWAITING_PAYMENT,
      vendorDisplayName: 'Hardening Webhook Vendor',
      requestedItems: 'One isolated webhook rehearsal item',
      pickup: point(0, 0),
      pickupText: 'Hardening webhook pickup',
      drop: point(0.001, 0.001),
      dropText: 'Hardening webhook drop',
      deliveryType: DELIVERY_TYPE.ASAP,
      deliveryWindowStart: now,
      deliveryWindowEnd: new Date(now.getTime() + 45 * 60 * 1000),
      pricing: {
        estimatedFoodCostPaise: 10000,
        customerDeliveryChargePaise: 4000,
        partnerBaseEarningPaise: 4000,
        platformFeePaise: 1000,
        estimatedCustomerTotalPaise: amountPaise,
      },
    });
    orderId = order._id;

    const payment = await Payment.create({
      orderId: order._id,
      customerId: customer._id,
      amountPaise,
      idempotencyKey: `${tag}_idem`,
      status: PAYMENT_STATUS.PENDING,
      activeAttempt: true,
      providerOrderId,
      providerReceipt: `rb_${tag}`,
    });
    paymentId = payment._id;

    const rawBody = Buffer.from(JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: providerOrderId,
            amount: amountPaise,
          },
        },
      },
    }));
    const signature = createHmac('sha256', env.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    console.log('Sending the same signed synthetic Razorpay event twice...');
    const first = await handleRazorpayWebhook({ rawBody, signature, eventId });
    const second = await handleRazorpayWebhook({ rawBody, signature, eventId });

    const [refreshedPayment, refreshedOrder, eventCount, attemptCount] = await Promise.all([
      Payment.findById(payment._id).lean(),
      Order.findById(order._id).lean(),
      WebhookEvent.countDocuments({ eventId }),
      MatchingAttempt.countDocuments({ orderId: order._id }),
    ]);

    console.table([
      { delivery: 'first', duplicate: first.duplicate, processed: first.processed },
      { delivery: 'second', duplicate: second.duplicate, processed: second.processed },
    ]);
    console.log({
      paymentStatus: refreshedPayment?.status,
      orderStatus: refreshedOrder?.status,
      webhookEventCount: eventCount,
      matchingAttemptCount: attemptCount,
    });

    const passed =
      first.duplicate === false &&
      first.processed === true &&
      second.duplicate === true &&
      eventCount === 1 &&
      refreshedPayment?.status === PAYMENT_STATUS.CONFIRMED &&
      refreshedPayment?.providerPaymentId === providerPaymentId &&
      ![ORDER_STATUS.DRAFT, ORDER_STATUS.AWAITING_PAYMENT].includes(refreshedOrder?.status) &&
      attemptCount === 1;

    if (!passed) {
      throw new Error(
        'Webhook idempotency invariant failed: expected one event record, one matching attempt, and one confirmed payment.',
      );
    }

    console.log('\nPASS: duplicate Razorpay event was idempotent and did not duplicate matching/payment state.');
  } finally {
    if (orderId) {
      await Offer.deleteMany({ orderId });
      await MatchingAttempt.deleteMany({ orderId });
      await Order.deleteOne({ _id: orderId });
    }
    if (paymentId) await Payment.deleteOne({ _id: paymentId });
    await WebhookEvent.deleteOne({ eventId });
    if (customerId) await User.deleteOne({ _id: customerId });
    await mongoose.connection.close();
    console.log('Webhook rehearsal fixtures cleaned up.');
  }
}

main().catch(async (error) => {
  console.error('Webhook idempotency rehearsal failed:', error);
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  process.exitCode = 1;
});
