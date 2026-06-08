import test from "node:test";
import assert from "node:assert/strict";
import { contentFingerprint, safeJsonSize } from "./redact.ts";

test("contentFingerprint exposes length and hash but not raw text", () => {
	const fingerprint = contentFingerprint("top secret");
	assert.ok(fingerprint);

	assert.equal(fingerprint.length, 10);
	assert.match(fingerprint.sha256, /^[a-f0-9]{16}$/);
	assert.equal(JSON.stringify(fingerprint).includes("top secret"), false);
});

test("safeJsonSize returns JSON length for serializable values and undefined for cycles", () => {
	assert.equal(safeJsonSize({ a: 1 }), 7);
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	assert.equal(safeJsonSize(cyclic), undefined);
});
