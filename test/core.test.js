import test from "node:test";
import assert from "node:assert/strict";
import {
  project,
  validate,
  calculate,
  parseBackup,
  backup,
  round,
} from "../src/core.js";
const sample = () =>
  Object.fromEntries(project.fields.map(([key, , , value]) => [key, value]));
test("example validates and backup roundtrips without losing values", () => {
  const p = sample();
  assert.deepEqual(parseBackup(backup([p])), [p]);
  assert.deepEqual(validate(p), p);
});
test("reject wrong tool/version, extra fields and non-objects", () => {
  for (const bad of [
    "null",
    "[]",
    "{}",
    JSON.stringify({ tool: "wrong", version: 1, plans: [] }),
    JSON.stringify({ tool: project.slug, version: 2, plans: [] }),
    JSON.stringify({ tool: project.slug, version: 1, plans: [], extra: true }),
  ])
    assert.throws(() => parseBackup(bad));
  for (const bad of [
    null,
    [],
    { ...sample(), extra: 1 },
    { ...sample(), unit: "ft" },
    { ...sample(), name: "  " },
    { ...sample(), name: "x".repeat(121) },
  ])
    assert.throws(() => validate(bad));
});
test("reject malformed, oversized and too many plan backups", () => {
  assert.throws(() => parseBackup("{broken"));
  assert.throws(() => parseBackup("x".repeat(1000001)));
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        tool: project.slug,
        version: 1,
        plans: Array.from({ length: 101 }, sample),
      }),
    ),
  );
});
test("strict numeric types prevent null, string, boolean and nonfinite measurements", () => {
  const key = project.fields.find((f) => f[2] === "number")[0];
  for (const value of [null, true, "5", NaN, Infinity, -1, 0, 0.00001, 1000001])
    assert.throws(() => validate({ ...sample(), [key]: value }));
});
test("escaped-looking user labels remain plain data through backup", () => {
  const p = { ...sample(), name: "<img src=x onerror=alert(1)>" };
  assert.equal(parseBackup(backup([p]))[0].name, p.name);
});

test("six permutations include rotation-only fit with correct remaining depths", () => {
  const p = validate({
    ...sample(),
    sw: 40,
    sh: 25,
    sd: 32,
    iw: 32,
    ih: 25,
    id: 40,
    tolerance: 0,
  });
  const rows = calculate(p);
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((r) => r.fit).length, 1);
  assert.deepEqual(rows.find((r) => r.fit).item, [40, 25, 32]);
  assert.deepEqual(rows.find((r) => r.fit).clear, [0, 0, 0]);
});
test("exact boundary fits, unmet clearance and tiny overlap fail without rounding acceptance", () => {
  const p = {
    ...sample(),
    sw: 10,
    sh: 10,
    sd: 10,
    iw: 10,
    ih: 10,
    id: 10,
    tolerance: 0,
  };
  assert.ok(calculate(validate(p)).every((r) => r.fit));
  assert.ok(
    calculate(validate({ ...p, tolerance: 0.001 })).every((r) => !r.fit),
  );
  assert.ok(calculate(validate({ ...p, iw: 10.0001 })).every((r) => !r.fit));
});
test("negative clearance remains visible and an impossible volume has no fit", () => {
  const rows = calculate(validate({ ...sample(), sw: 1, sh: 1, sd: 1 }));
  assert.ok(rows.every((r) => !r.fit));
  assert.ok(rows.every((r) => r.clear.some((c) => c < 0)));
});

test("decimal boundary uses machine precision, not coarse display rounding", () => {
  const p = validate({
    ...sample(),
    sw: 35.3,
    sh: 35.3,
    sd: 35.3,
    iw: 35.2,
    ih: 35.2,
    id: 35.2,
    tolerance: 0.1,
  });
  assert.ok(calculate(p).every((r) => r.fit));
  assert.ok(calculate(validate({ ...p, iw: 35.2001 })).every((r) => !r.fit));
});
