// Проверка реального времени: 100 открытых соединений + отклик API под ними.
// Запуск из папки frontend (там лежит socket.io-client):
//   node ../tools/ws-load.mjs 100
import { io } from 'socket.io-client';

const API = 'http://localhost:3000';
const COUNT = Number(process.argv[2] ?? 100);

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await res.json()).accessToken;
}

async function measure(token, path, times = 20) {
  const samples = [];
  for (let i = 0; i < times; i++) {
    const t0 = performance.now();
    await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    median: Math.round(samples[Math.floor(samples.length / 2)]),
    max: Math.round(samples[samples.length - 1]),
  };
}

const leadToken = await login('site_lead', 'password123');

const before = await measure(leadToken, '/distribution/summary');
console.log(`Без соединений:  median ${before.median} ms, max ${before.max} ms`);

console.log(`Открываю ${COUNT} соединений реального времени...`);
const sockets = [];
let connected = 0;
let received = 0;

await new Promise((resolve) => {
  for (let i = 0; i < COUNT; i++) {
    const socket = io(API, { transports: ['websocket'], reconnection: false });
    socket.on('connect', () => {
      connected++;
      if (connected === COUNT) resolve();
    });
    socket.on('distribution:changed', () => received++);
    sockets.push(socket);
  }
  setTimeout(resolve, 15000);
});
console.log(`Подключено: ${connected} из ${COUNT}`);

const during = await measure(leadToken, '/distribution/summary');
console.log(`С соединениями:  median ${during.median} ms, max ${during.max} ms`);

// Событие рассылается всем подключённым — смотрим фан-аут на одно действие.
const ops = await (
  await fetch(`${API}/distribution/operations`, { headers: { Authorization: `Bearer ${leadToken}` } })
).json();
const roster = await (
  await fetch(`${API}/distribution/summary`, { headers: { Authorization: `Bearer ${leadToken}` } })
).json();
const op = ops[0];
const person = roster.roster?.[0];
if (op && person) {
  received = 0;
  const t0 = performance.now();
  const created = await fetch(`${API}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leadToken}` },
    body: JSON.stringify({ operationId: op.id, userId: person.userId, quantity: 1 }),
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log(
    `Одно назначение разослано ${received} клиентам за ${Math.round(performance.now() - t0)} ms`,
  );
  if (created.ok) {
    const body = await created.json();
    await fetch(`${API}/assignments/${body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${leadToken}` },
    });
  } else {
    console.log('  назначение не создалось:', created.status, (await created.text()).slice(0, 120));
  }
} else {
  console.log('Нет операций или людей для проверки рассылки');
}

sockets.forEach((s) => s.close());
process.exit(0);
