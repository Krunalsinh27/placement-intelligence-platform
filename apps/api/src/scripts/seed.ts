import { getEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { OrganizationModel } from '../models/organization.model.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';

export async function runSeed(): Promise<void> {
  const env = getEnv();

  // Guard against running seed in production
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to execute development seed script in production environment.');
  }

  console.log('[seed] Connecting to MongoDB for seeding...');
  await connectDatabase(env.MONGODB_URI);

  try {
    // 1. Idempotently create Demo College Organization
    let org = await OrganizationModel.findOne({ slug: 'demo-college' });
    if (!org) {
      org = await OrganizationModel.create({
        name: 'Demo Institute of Technology',
        slug: 'demo-college',
        code: 'DIT',
        status: 'active',
      });
      console.log(`[seed] Created demo organization: ${org.name} (${org.slug})`);
    } else {
      console.log(`[seed] Demo organization already exists: ${org.name}`);
    }

    // 2. Idempotently create Demo TPO User
    const demoEmail = 'tpo.demo@example.com';
    let user = await UserModel.findOne({ email: demoEmail });
    if (!user) {
      const passwordHash = await hashPassword('Password123!');
      user = await UserModel.create({
        email: demoEmail,
        passwordHash,
        fullName: 'Prof. Demo Coordinator',
        status: 'active',
        memberships: [
          {
            orgId: org._id,
            role: 'tpo',
          },
        ],
      });
      console.log(`[seed] Created demo TPO user: ${user.email} (role: tpo)`);
    } else {
      console.log(`[seed] Demo user already exists: ${user.email}`);
    }

    console.log('\n[seed] Seeding completed successfully!');
    console.log('──────────────────────────────────────────────────────');
    console.log('Demo Credentials for Local Development:');
    console.log(`  Email:    ${demoEmail}`);
    console.log('  Password: Password123!');
    console.log(`  Role:     tpo`);
    console.log(`  College:  ${org.name}`);
    console.log('──────────────────────────────────────────────────────\n');
  } finally {
    await disconnectDatabase();
    console.log('[seed] Database connection closed.');
  }
}

// Execute directly if run as a script
if (process.argv[1]?.includes('seed')) {
  runSeed().catch((err) => {
    console.error('[seed] Error during seeding:', err);
    process.exit(1);
  });
}
