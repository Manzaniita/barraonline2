/**
 * BARRAONLINE.COM.AR — SUITE DE PRUEBAS DE CARGA Y CONCURRENCIA (k6)
 * Ejecución: k6 run -e BASE_URL=http://localhost:3000 tests/load/barraonline-load-suite.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    // 1. Lectura masiva de carta en 4G inestable
    catalog_readers: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '20s', target: 300 },
        { duration: '30s', target: 3000 },
        { duration: '15s', target: 0 },
      ],
      exec: 'readCatalogScenario',
    },
    // 2. Checkouts concurrentes y reservas temporales de stock
    concurrent_checkouts: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 150,
      exec: 'checkoutReservationScenario',
    },
  },
  thresholds: {
    'http_req_duration{scenario:catalog_readers}': ['p(95)<120', 'p(99)<250'],
    'http_req_duration{scenario:concurrent_checkouts}': ['p(95)<450'],
    http_req_failed: ['rate<0.01'],
  },
};

export function readCatalogScenario() {
  const slug = Math.random() < 0.5 ? 'museum' : 'pueblo-limite';
  const res = http.get(`${BASE_URL}/api/v1/tenants/${slug}/catalog`, {
    headers: { Accept: 'application/json' },
  });

  check(res, {
    'catálogo responde 200 OK': (r) => r.status === 200,
    'catálogo aislado al tenant correcto': (r) => r.body.includes(`"slug":"${slug}"`),
  });
  sleep(0.3);
}

export function checkoutReservationScenario() {
  const idemKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    action: 'CREATE_CHECKOUT',
    idempotencyKey: idemKey,
    customerDisplayName: `VU-${__VU}`,
    items: [
      {
        productId: '11111111-2000-4111-8111-111111111201',
        quantity: 1,
      },
    ],
  });

  const res = http.post(`${BASE_URL}/api/v1/tenants/museum/checkout`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idemKey,
    },
  });

  check(res, {
    'checkout responde 200 (reservado) o 409 (agotado sin sobreventa)': (r) =>
      r.status === 200 || r.status === 409,
  });
}
