import http from 'k6/http';
import { check } from 'k6';

// 1. The Attack Configuration
export const options = {
  vus: 10,         // 10 simultaneous attackers
  duration: '2s',  // Blast the server for 2 seconds straight
};

// 2. The Payload
export default function () {
  const url = 'http://localhost:3000/payment';
  
  const payload = JSON.stringify({
    amount: 50000,
    // CRITICAL: You must change this number manually every time you run a new test!
    idempotencyKey: 'STRESS-TEST-001', 
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  // 3. Fire the Request
  const res = http.post(url, payload, params);

  // 4. Log the results (We EXPECT to see 409s!)
  check(res, {
    'Transaction Successful (200)': (r) => r.status === 200,
    'Redis Deflection (409)': (r) => r.status === 409,
  });
}