import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { hashPassword } from '../utils/password.js';

async function runAuthFlowsTest() {
  console.log('===============================================================');
  console.log('     PART 2: AUTHENTICATION & USER PROFILE FLOW AUDIT          ');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  let createdUsers = [];

  try {
    // 1. Customer Registration
    const customerPayload = {
      fullName: 'Customer Test User',
      email: `customer_${timestamp}@sanitigo.com`,
      password: 'Password@123',
      phoneNumber: '9876543210',
      role: 'USER',
    };

    console.log('[1/8] Testing Customer Registration (POST /api/v1/auth/register)...');
    const customerRegRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customerPayload);

    if (customerRegRes.status !== 201) {
      throw new Error(`Customer registration failed: ${customerRegRes.status} - ${JSON.stringify(customerRegRes.body)}`);
    }
    const customerUser = customerRegRes.body.data.user;
    const customerToken = customerRegRes.body.data.accessToken;
    createdUsers.push(customerUser.id);
    console.log(`  ✓ Customer registered successfully (ID: ${customerUser.id}, Role: ${customerUser.role})`);

    // 2. Toilet Owner Registration
    const ownerPayload = {
      fullName: 'Owner Test User',
      email: `owner_${timestamp}@sanitigo.com`,
      password: 'Password@123',
      phoneNumber: '9876543211',
      role: 'OWNER',
    };

    console.log('\n[2/8] Testing Owner Registration (POST /api/v1/auth/register)...');
    const ownerRegRes = await request(app)
      .post('/api/v1/auth/register')
      .send(ownerPayload);

    if (ownerRegRes.status !== 201) {
      throw new Error(`Owner registration failed: ${ownerRegRes.status} - ${JSON.stringify(ownerRegRes.body)}`);
    }
    const ownerUser = ownerRegRes.body.data.user;
    const ownerToken = ownerRegRes.body.data.accessToken;
    createdUsers.push(ownerUser.id);
    console.log(`  ✓ Toilet Owner registered successfully (ID: ${ownerUser.id}, Role: ${ownerUser.role})`);

    // 3. Customer Login
    console.log('\n[3/8] Testing Customer Login (POST /api/v1/auth/login)...');
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customerPayload.email,
        password: customerPayload.password,
      });

    if (loginRes.status !== 200 || !loginRes.body.data.accessToken) {
      throw new Error(`Customer login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
    }
    console.log('  ✓ Customer login succeeded with fresh JWT token.');

    // 4. Role-based Route Protection
    console.log('\n[4/8] Testing Role Protection (Customer attempting Admin endpoint)...');
    const forbiddenRes = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${customerToken}`);

    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer on admin route, got ${forbiddenRes.status}`);
    }
    console.log('  ✓ RBAC enforced: Customer correctly rejected with 403 Forbidden from Admin route.');

    // 5. Admin Superuser Access
    console.log('\n[5/8] Testing Admin Access with Admin Role...');
    const hashedAdminPassword = await hashPassword('Password@123');
    const adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test User',
        email: `admin_${timestamp}@sanitigo.com`,
        password: hashedAdminPassword,
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
      },
    });
    createdUsers.push(adminUser.id);

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: adminUser.email,
        password: 'Password@123',
      });
    const adminToken = adminLoginRes.body.data.accessToken;

    const adminStatsRes = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    if (adminStatsRes.status !== 200) {
      throw new Error(`Admin stats failed for admin user: ${adminStatsRes.status}`);
    }
    console.log('  ✓ Admin authorization succeeded (200 OK) with full statistical telemetry.');

    // 6. Profile Viewing
    console.log('\n[6/8] Testing Profile Retrieval (GET /api/v1/auth/me)...');
    const profileRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    if (profileRes.status !== 200 || profileRes.body.data.email !== customerPayload.email) {
      throw new Error(`Profile retrieval failed: ${profileRes.status}`);
    }
    console.log(`  ✓ Current profile retrieved: ${profileRes.body.data.fullName} (${profileRes.body.data.email})`);

    // 7. Profile Updating
    console.log('\n[7/8] Testing Profile Update (PUT /api/v1/auth/profile)...');
    const updatedName = 'Customer Updated Name';
    const updatedPhone = '9123456789';

    const updateProfileRes = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        fullName: updatedName,
        phoneNumber: updatedPhone,
      });

    if (updateProfileRes.status !== 200 || updateProfileRes.body.data.fullName !== updatedName) {
      throw new Error(`Profile update failed: ${updateProfileRes.status} - ${JSON.stringify(updateProfileRes.body)}`);
    }
    console.log(`  ✓ Profile updated successfully: fullName='${updateProfileRes.body.data.fullName}', phone='${updateProfileRes.body.data.phoneNumber}'`);

    // 8. Token Expiry & Unauthorized Handling
    console.log('\n[8/8] Testing Invalid/Expired Token Rejection (401 Unauthorized)...');
    const invalidTokenRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_forged_expired_jwt_token_12345');

    if (invalidTokenRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for bad token, got ${invalidTokenRes.status}`);
    }
    console.log('  ✓ Invalid / expired token properly rejected with 401 Unauthorized.');

    console.log('\n===============================================================');
    console.log('      ALL PART 2 AUTHENTICATION & PROFILE TESTS PASSED!        ');
    console.log('===============================================================');
  } finally {
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUsers } },
      });
      console.log(`\n[Cleanup] Removed ${createdUsers.length} test user records from database.`);
    }
    await prisma.$disconnect();
  }
}

runAuthFlowsTest().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
