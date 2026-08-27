import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { USER_ROLES } from '../src/constants/auth.constants.js';
import { Partner } from '../src/models/partner.model.js';
import { User } from '../src/models/user.model.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run admin:promote -- user@example.com');
  process.exit(1);
}

try {
  await connectDatabase();

  const user = await User.findOne({ email }).select('_id role');

  if (!user) {
    console.error(`No RouteBite user found with email ${email}`);
    process.exitCode = 1;
  } else {
    const partnerExists = await Partner.exists({ userId: user._id });

    if (partnerExists && user.role !== USER_ROLES.ADMIN) {
      console.error(
        `Cannot promote ${email} to ADMIN because this account already has a partner profile. Use a separate internal admin account.`,
      );
      process.exitCode = 1;
    } else {
      await User.updateOne(
        { _id: user._id },
        { $set: { role: USER_ROLES.ADMIN } },
      );

      if (partnerExists) {
        console.warn(
          `Warning: ${email} is already ADMIN but has a legacy partner profile. Partner capability is blocked while the account remains ADMIN.`,
        );
      }

      console.log(`Promoted ${email} to ADMIN.`);
    }
  }
} catch (error) {
  console.error('Failed to promote admin user', error);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close().catch(() => {});
}
