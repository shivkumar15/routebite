import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { DELIVERY_TYPE, ORDER_STATUS } from '../src/constants/order.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_VERIFICATION_STATUS,
} from '../src/constants/partner.constants.js';
import { Order } from '../src/models/order.model.js';
import { PartnerEarning } from '../src/models/partner-earning.model.js';
import { Partner } from '../src/models/partner.model.js';
import { User } from '../src/models/user.model.js';
import {
  hashOtp,
  verifyDeliveryOtpAndComplete,
} from '../src/services/delivery-otp.service.js';

const CONFIRM_FLAG = '--confirm-dev-db';

function assertExplicitConfirmation() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Refusing to create rehearsal fixtures without ${CONFIRM_FLAG}.\n` +
        `Run: npm run hardening:completion-idempotency -- ${CONFIRM_FLAG}`,
    );
    process.exit(2);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run completion hardening with NODE_ENV=production.');
    process.exit(2);
  }
}

function point(longitude, latitude) {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

async function main() {
  assertExplicitConfirmation();
  await connectDatabase();

  const tag = `hardening_completion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ids = { userIds: [], partnerId: null, orderId: null };

  try {
    const customer = await User.create({
      name: 'Hardening Completion Customer',
      email: `${tag}_customer@example.test`,
      phone: `+91${String(Date.now()).slice(-10)}`,
      passwordHash: 'hardening-fixture-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    ids.userIds.push(customer._id);

    const partnerUser = await User.create({
      name: 'Hardening Completion Partner',
      email: `${tag}_partner@example.test`,
      phone: `+92${String(Date.now()).slice(-10)}`,
      passwordHash: 'hardening-fixture-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    ids.userIds.push(partnerUser._id);

    const partner = await Partner.create({
      userId: partnerUser._id,
      verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
      profilePhotoAssetId: new mongoose.Types.ObjectId(),
      collegeIdentity: {
        enrollmentNumber: `${tag}-partner`,
        collegeName: 'RouteBite Hardening Fixture',
        documentAssetId: new mongoose.Types.ObjectId(),
      },
      availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
    });
    ids.partnerId = partner._id;

    const now = new Date();
    const orderId = new mongoose.Types.ObjectId();
    const otp = '123456';
    const order = await Order.create({
      _id: orderId,
      customerId: customer._id,
      status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
      vendorDisplayName: 'Hardening Completion Vendor',
      requestedItems: 'One isolated completion rehearsal item',
      pickup: point(85.54828, 26.54092),
      pickupText: 'Hardening completion pickup',
      drop: point(85.552, 26.545),
      dropText: 'Hardening completion drop',
      deliveryType: DELIVERY_TYPE.ASAP,
      deliveryWindowStart: new Date(now.getTime() - 30 * 60 * 1000),
      deliveryWindowEnd: new Date(now.getTime() + 15 * 60 * 1000),
      assignedPartnerId: partner._id,
      deliveryOtpRequestedAt: now,
      deliveryOtp: {
        hash: hashOtp(orderId.toString(), otp),
        generatedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        attempts: 0,
        usedAt: null,
      },
      pricing: {
        estimatedFoodCostPaise: 10000,
        customerDeliveryChargePaise: 4000,
        partnerBaseEarningPaise: 4000,
        platformFeePaise: 1000,
        estimatedCustomerTotalPaise: 15000,
        finalCustomerTotalPaise: 15000,
      },
    });
    ids.orderId = order._id;

    await Partner.updateOne(
      { _id: partner._id },
      { $set: { activeOrderId: order._id } },
    );

    console.log('Firing the same valid delivery OTP completion twice concurrently...');
    const results = await Promise.allSettled([
      verifyDeliveryOtpAndComplete({ partnerId: partner._id, otp }, new Date()),
      verifyDeliveryOtpAndComplete({ partnerId: partner._id, otp }, new Date()),
    ]);

    const [refreshedOrder, refreshedPartner, earnings] = await Promise.all([
      Order.findById(order._id).select('+deliveryOtp.hash').lean(),
      Partner.findById(partner._id).lean(),
      PartnerEarning.find({ orderId: order._id }).lean(),
    ]);

    console.table(
      results.map((result, index) => ({
        attempt: index + 1,
        result: result.status,
        code: result.status === 'rejected'
          ? result.reason?.code ?? result.reason?.message
          : result.value?.status,
      })),
    );
    console.log({
      orderStatus: refreshedOrder?.status,
      otpUsed: Boolean(refreshedOrder?.deliveryOtp?.usedAt),
      partnerActiveOrderId: refreshedPartner?.activeOrderId ?? null,
      completedOrderCount: refreshedPartner?.completedOrderCount,
      earningCount: earnings.length,
    });

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    const passed =
      fulfilled.length === 1 &&
      rejected.length === 1 &&
      refreshedOrder?.status === ORDER_STATUS.COMPLETED &&
      Boolean(refreshedOrder?.deliveryOtp?.usedAt) &&
      !refreshedPartner?.activeOrderId &&
      Number(refreshedPartner?.completedOrderCount ?? 0) === 1 &&
      earnings.length === 1;

    if (!passed) {
      throw new Error(
        'Completion idempotency invariant failed: expected one completion, one earning, and one completed-order increment.',
      );
    }

    console.log('\nPASS: duplicate completion produced exactly one completed order and one partner earning.');
  } finally {
    if (ids.orderId) {
      await PartnerEarning.deleteMany({ orderId: ids.orderId });
      await Order.deleteOne({ _id: ids.orderId });
    }
    if (ids.partnerId) await Partner.deleteOne({ _id: ids.partnerId });
    if (ids.userIds.length) await User.deleteMany({ _id: { $in: ids.userIds } });
    await mongoose.connection.close();
    console.log('Completion rehearsal fixtures cleaned up.');
  }
}

main().catch(async (error) => {
  console.error('Completion idempotency rehearsal failed:', error);
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  process.exitCode = 1;
});
