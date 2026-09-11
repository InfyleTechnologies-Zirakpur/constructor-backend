import fetch from 'node-fetch';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:3000/api/v1';
let accessToken = '';
let testJobId = '';

async function testEndpoint(method, path, body = null, useAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  if (useAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`\nTesting: ${method} ${path}`);
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(data).substring(0, 150)}...`);
    
    if (path === '/auth/verify-otp') {
      accessToken = data.data.accessToken;
    }
    if (path === '/jobs' && data.data.items.length > 0) {
      testJobId = data.data.items[0].id;
    }
  } catch (err) {
    console.error(`Failed: ${err.message}`);
  }
}

async function runTests() {
  console.log('--- STARTING ENDPOINT VERIFICATION ---');
  
  // 1. Auth endpoints
  await testEndpoint('POST', '/auth/request-otp', { phone: '8888888888' }, false);
  
  // Hack to get the DB OTP hash updated so we can login with '123456'
  execSync(`psql postgres://postgres:postgres@localhost:5432/construction_db -c "UPDATE users SET \\"otpHash\\" = '$2b$10$EVTv.rSzsK.DTXdniY6fKOVsZDROMtxKO54XZ51sPjXBQALeFpkAi' WHERE phone='8888888888';" > /dev/null`);
  
  await testEndpoint('POST', '/auth/verify-otp', { phone: '8888888888', otp: '123456' }, false);
  
  // 2. Profile endpoints
  await testEndpoint('GET', '/profile');
  await testEndpoint('PUT', '/profile', { city: 'New Delhi' });
  
  // 3. Jobs endpoints
  await testEndpoint('GET', '/jobs');
  
  if (testJobId) {
    await testEndpoint('POST', `/jobs/${testJobId}/save`);
    await testEndpoint('POST', `/jobs/${testJobId}/applications`, { coverNote: 'Interested' });
  } else {
    console.log('Skipping job specific endpoints because no jobs found.');
  }
  
  // 4. Other core endpoints
  await testEndpoint('GET', '/dashboard');
  await testEndpoint('POST', '/attendance/check-in', { latitude: 30.2, longitude: 74.9 });
  await testEndpoint('GET', '/attendance');
  await testEndpoint('GET', '/notifications');
  await testEndpoint('GET', '/conversations');
  await testEndpoint('GET', '/documents');
  
  console.log('\n--- VERIFICATION COMPLETE ---');
}

runTests();
