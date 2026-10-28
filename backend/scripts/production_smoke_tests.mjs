/**
 * =============================================================================
 * SanitiGo Production Safe Smoke Tests
 * File: backend/scripts/production_smoke_tests.mjs
 * 
 * Purpose: Safe, non-polluting verification of live production endpoints.
 * Guarantees:
 *  - ZERO synthetic test records or dummy bookings written to production database.
 *  - Probes live root, operational health, CORS preflight, and discovery APIs.
 *  - Probes security boundaries (mock payment rejection, webhook signature verification).
 * =============================================================================
 */

import axios from 'axios';

const BASE_URL = process.env.PRODUCTION_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://sanitigo-frontend-prod.onrender.com';

const results = [];

function recordResult(name, passed, details = '') {
  results.push({ name, passed, details });
  const statusMark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusMark}] ${name}${details ? ` - ${details}` : ''}`);
}

async function runProductionSmokeTests() {
  console.log('===============================================================');
  console.log('🚀 Starting SanitiGo Safe Production Smoke Tests');
  console.log(`🎯 Target API Base URL : ${BASE_URL}`);
  console.log(`🌐 Frontend Origin     : ${FRONTEND_ORIGIN}`);
  console.log(`🛡️  Safety Guarantee    : Strictly Read-Only / Zero Production Fixtures`);
  console.log('===============================================================\n');

  // Test 1: Root Liveness Probe
  try {
    const res = await axios.get(`${BASE_URL}/`, { timeout: 10000 });
    const passed = res.status === 200 && (res.data?.success === true || typeof res.data === 'string');
    recordResult('1. Root Liveness Probe (GET /)', passed, `Status: ${res.status}`);
  } catch (err) {
    recordResult('1. Root Liveness Probe (GET /)', false, err.message);
  }

  // Test 2: Operational Health Check (GET /api/health/operations)
  try {
    const res = await axios.get(`${BASE_URL}/api/health/operations`, { timeout: 10000 });
    const isHealthy = res.status === 200 && res.data?.status !== 'DEGRADED';
    const outboxBacklog = res.data?.metrics?.outboxPendingCount ?? 0;
    const dlqBacklog = res.data?.metrics?.dlqMessageCount ?? 0;
    recordResult(
      '2. Operational Health Probe (GET /api/health/operations)',
      isHealthy,
      `Status: ${res.status}, Health: ${res.data?.status || 'OK'}, Outbox Pending: ${outboxBacklog}, DLQ: ${dlqBacklog}`
    );
  } catch (err) {
    recordResult('2. Operational Health Probe (GET /api/health/operations)', false, err.message);
  }

  // Test 3: CORS Preflight Verification from Production Frontend Origin
  try {
    const res = await axios({
      method: 'OPTIONS',
      url: `${BASE_URL}/api/v1/toilets`,
      headers: {
        Origin: FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      },
      validateStatus: () => true,
      timeout: 10000
    });
    const allowOrigin = res.headers['access-control-allow-origin'];
    const allowCredentials = res.headers['access-control-allow-credentials'];
    const passed = (res.status === 200 || res.status === 204) &&
      (allowOrigin === FRONTEND_ORIGIN || allowOrigin === '*');
    recordResult(
      '3. CORS Preflight Verification (OPTIONS /api/v1/toilets)',
      passed,
      `Status: ${res.status}, Allow-Origin: ${allowOrigin}, Allow-Credentials: ${allowCredentials}`
    );
  } catch (err) {
    recordResult('3. CORS Preflight Verification (OPTIONS /api/v1/toilets)', false, err.message);
  }

  // Test 4: Public Facility Discovery & Listing (Read-Only)
  try {
    const res = await axios.get(`${BASE_URL}/api/v1/toilets?limit=5`, { timeout: 10000 });
    const passed = res.status === 200 && (Array.isArray(res.data?.data) || Array.isArray(res.data?.data?.toilets));
    const count = Array.isArray(res.data?.data) ? res.data.data.length : (res.data?.data?.toilets?.length || 0);
    recordResult(
      '4. Public Facility Discovery Query (GET /api/v1/toilets)',
      passed,
      `Status: ${res.status}, Retrieved Toilets: ${count}`
    );
  } catch (err) {
    recordResult('4. Public Facility Discovery Query (GET /api/v1/toilets)', false, err.message);
  }

  // Test 5: Toilet Amenities Metadata Endpoint (Read-Only)
  try {
    const res = await axios.get(`${BASE_URL}/api/v1/toilets/amenities`, { timeout: 10000 });
    const passed = res.status === 200 && res.data?.success === true;
    recordResult('5. Amenities Metadata Endpoint (GET /api/v1/toilets/amenities)', passed, `Status: ${res.status}`);
  } catch (err) {
    recordResult('5. Amenities Metadata Endpoint (GET /api/v1/toilets/amenities)', false, err.message);
  }

  // Test 6: Security Boundary - Mock Payment Route Disabled
  try {
    const res = await axios.post(
      `${BASE_URL}/api/v1/bookings/prod-probe-dummy-id/payment/mock-result`,
      { mockStatus: 'SUCCESS' },
      { validateStatus: () => true, timeout: 10000 }
    );
    const passed = res.status === 403 || res.status === 404;
    recordResult(
      '6. Security Boundary: Mock Payment Route Disabled',
      passed,
      `Status: ${res.status} (Mock simulation strictly forbidden in production)`
    );
  } catch (err) {
    recordResult('6. Security Boundary: Mock Payment Route Disabled', false, err.message);
  }

  // Test 7: Security Boundary - Invalid Webhook Signature Rejection
  try {
    const res = await axios.post(
      `${BASE_URL}/api/v1/bookings/payment/webhook`,
      { event: 'payment.captured' },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_forged_signature_0000000000000000000000000000'
        },
        validateStatus: () => true,
        timeout: 10000
      }
    );
    const passed = res.status === 400 || res.status === 401;
    recordResult(
      '7. Security Boundary: Invalid Webhook Signature Rejected',
      passed,
      `Status: ${res.status} (Forged/missing HMAC signatures rejected)`
    );
  } catch (err) {
    recordResult('7. Security Boundary: Invalid Webhook Signature Rejected', false, err.message);
  }

  // Test 8: Security Headers Audit
  try {
    const res = await axios.get(`${BASE_URL}/`, { timeout: 10000 });
    const hasNoSniff = res.headers['x-content-type-options'] === 'nosniff';
    recordResult(
      '8. Security Headers Audit (Helmet / OWASP)',
      hasNoSniff,
      `X-Content-Type-Options: ${res.headers['x-content-type-options'] || 'absent'}`
    );
  } catch (err) {
    recordResult('8. Security Headers Audit (Helmet / OWASP)', false, err.message);
  }

  // Summary
  console.log('\n===============================================================');
  console.log('📊 Production Smoke Test Results Summary');
  console.log('===============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`Passed: ${passedCount} / ${totalCount} (${Math.round((passedCount / totalCount) * 100)}%)`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL SAFE PRODUCTION SMOKE TESTS PASSED!');
    return 0;
  } else {
    console.error('⚠️ ONE OR MORE TESTS FAILED. Investigate before live traffic.');
    return 1;
  }
}

if (process.argv[1].endsWith('production_smoke_tests.mjs')) {
  runProductionSmokeTests().then(code => {
    if (code !== 0 && process.env.CI) {
      process.exit(code);
    }
  });
}

export { runProductionSmokeTests };
