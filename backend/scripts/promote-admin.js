import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { USER_ROLES } from '../src/constants/auth.constants.js';
import { User } from '../src/models/user.model.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run admin:promote -- user@example.com');
  process.exit(1);
}

try {
  await connectDatabase();

  const result = await User.updateOne(
    { email },
    { $set: { role: USER_ROLES.ADMIN } },
  );

  if (result.matchedCount === 0) {
    console.error(`No RouteBite user found with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${email} to ADMIN.`);
  }
} catch (error) {
  console.error('Failed to promote admin user', error);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close().catch(() => {});
}
