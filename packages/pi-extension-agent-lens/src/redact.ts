import { createHash } from "node:crypto";

export interface ContentFingerprint {
	length: number;
	sha256: string;
}

export function contentFingerprint(value: string | undefined): ContentFingerprint | undefined {
	if (value === undefined) return undefined;
	return {
		length: value.length,
		sha256: createHash("sha256").update(value).digest("hex").slice(0, 16),
	};
}

export function safeJsonSize(value: unknown): number | undefined {
	try {
		return JSON.stringify(value).length;
	} catch {
		return undefined;
	}
}
