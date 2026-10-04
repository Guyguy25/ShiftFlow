const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../whatsapp_service.js'), 'utf8');
function fixture() {
  let callback, destroyed = 0;
  const context = { Date, setTimeout: fn => { callback = fn; return 1; }, clearTimeout() {}, destroySocket: async s => { destroyed++; s.sock = null; } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function stopPairingTimer'), source.indexOf('async function resetSessionForNewLogin')), context);
  const state = { connected: false, established: false, pairingExpired: false, generation: 2, sock: {}, qr: 'qr', qrText: 'qr', reconnectTimer: 4 };
  return { context, state, expire: () => callback(), destroyed: () => destroyed };
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
