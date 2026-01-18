// server/services/perf.js
export async function timeIt(label, fn, extra = {}) {
  const start = process.hrtime.bigint();
  try {
    const value = await fn();
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    return { value, ms, label, ok: true, extra };
  } catch (err) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    return { err, ms, label, ok: false, extra };
  }
}
