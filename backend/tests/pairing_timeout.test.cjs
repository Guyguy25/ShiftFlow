const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../whatsapp_service.js'), 'utf8');
function fixture() {
  let callback, destroyed = 0, now = 100000;
  const delays = [];
  const context = { Date: { now: () => now }, setTimeout: (fn, ms) => { callback = fn; delays.push(ms); return delays.length; }, clearTimeout() {}, destroySocket: async s => { destroyed++; s.sock = null; } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function stopPairingTimer'), source.indexOf('async function resetSessionForNewLogin')), context);
  const state = { connected: false, established: false, pairingExpired: false, generation: 2, sock: {}, qr: 'qr', qrText: 'qr', reconnectTimer: 4 };
  return { context, state, delays, advance: ms => { now += ms; }, expire: () => callback(), destroyed: () => destroyed };
}
test('stalled link expires, invalidates old events and stops reconnection', async () => {
  const f = fixture(); f.context.beginPairing(f.state); await f.expire();
  assert.equal(f.state.pairingExpired, true); assert.equal(f.state.lastConnectionError, 'pairing_timeout');
  assert.equal(f.state.generation, 3); assert.equal(f.state.qr, null); assert.equal(f.state.reconnectTimer, null);
  assert.equal(f.destroyed(), 1);
});
test('connection opening before deadline preserves socket', async () => {
  const f = fixture(); f.context.beginPairing(f.state); f.state.connected = true; await f.expire();
  assert.equal(f.destroyed(), 0); assert.equal(f.state.pairingExpired, false);
});
test('established sessions never receive a pairing timeout', () => {
  const f = fixture(); f.state.established = true; f.context.beginPairing(f.state);
  assert.equal(f.state.pairingDeadline, undefined); assert.equal(f.destroyed(), 0);
});
test('repeated QR updates do not extend deadline', () => {
  const f = fixture(); f.context.beginPairing(f.state); const deadline = f.state.pairingDeadline;
  f.context.beginPairing(f.state); assert.equal(f.state.pairingDeadline, deadline);
});

test('the existing login deadline is exactly 60 seconds', () => {
  const f = fixture(); f.context.beginPairing(f.state);
  assert.equal(f.state.pairingDeadline, f.context.Date.now() + 60000);
  assert.deepEqual(f.delays, [60000]);
});

test('the pair-code response exposes the original deadline and server clock without extending the attempt', async () => {
  const f = fixture(); f.context.beginPairing(f.state);
  const deadline = f.state.pairingDeadline;
  f.advance(37000);
  f.state.qrText = 'qr';
  f.state.sock = { requestPairingCode: async () => { f.advance(5000); return 'ABCD1234'; } };
  let handler, response;
  Object.assign(f.context, {
    app: { post: (_path, callback) => { handler = callback; } },
    getSession: () => f.state,
    sessionFromRequest: () => 'test',
    normalizeSendNumber: phone => phone,
    shuttingDown: false,
    console: { log() {}, error() {} },
  });
  vm.runInContext(source.slice(source.indexOf('app.post("/session/pair-code"'), source.indexOf('app.post("/session/logout"')), f.context);
  await handler({ body: { phone: '33612345678' } }, { json: data => { response = data; } });
  assert.equal(response.code, 'ABCD1234');
  assert.equal(response.pairingDeadline, deadline);
  assert.equal(response.serverTime, f.context.Date.now());
  assert.equal(response.pairingDeadline - response.serverTime, 18000);
  assert.equal(f.state.pairingDeadline, deadline);
});
