import http from 'k6/http';
import { check, sleep } from 'k6';

// --- TEST CONFIGURATION ---
// This section defines how the test will run.
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Stage 1: Ramp-up from 0 to 100 virtual users over 30 seconds.
    { duration: '1m', target: 100 },  // Stage 2: Stay at a steady load of 100 users for 1 minute.
    { duration: '30s', target: 0 },   // Stage 3: Ramp-down back to 0 users.
  ],
  thresholds: {
    // --- SUCCESS CRITERIA ---
    // These are the goals for our test. If any of these fail, the test will exit with an error.

    // We want 95% of all requests to complete in under 200 milliseconds.
    'http_req_duration': ['p(95)<200'],

    // We want the error rate to be less than 1%.
    'http_req_failed': ['rate<0.01'],
  },
};

// --- VIRTUAL USER BEHAVIOR ---
// This is the code that each virtual user will run over and over again.
export default function () {
  // Make an HTTP GET request to our paginated API endpoint, via the API Gateway.
  const res = http.get('http://localhost:4000/api/vehicles?page=1&limit=20');

  // Check if the request was successful (i.e., the server responded with a status code of 200).
  check(res, { 'status was 200': (r) => r.status == 200 });

  // Wait for 1 second before this virtual user makes another request.
  sleep(1);
}