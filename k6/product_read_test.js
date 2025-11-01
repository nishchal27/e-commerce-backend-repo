import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const PRODUCT_ID = __ENV.PRODUCT_ID || '';
const PATH = `${BASE}/products/${PRODUCT_ID}`;

export const options = {
  vus: Number(__ENV.VUS) || 20,
  duration: __ENV.DURATION || '30s',
  thresholds: { http_req_failed: ['rate<0.05'] }
};

export default function () {
  const res = http.get(PATH, { headers: { Accept: 'application/json' } });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}
