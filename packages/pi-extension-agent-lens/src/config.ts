import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type CaptureProfile = "redacted";

export interface AgentLensRetentionConfig {
	maxTraceFiles: number | null;
	maxAgeDays: number | null;
}

export interface AgentLensConfig {
	artifactRoot: string;
	liveReportRefreshSeconds: number;
	captureProfile: CaptureProfile;
	retention: AgentLensRetentionConfig;
	source: string;
	warning?: string;
}

export interface LoadAgentLensConfigOptions {
	cwd?: string;
}

const DEFAULT_CONFIG_FILE = ".pi-agent-lens/config.json";

export function loadAgentLensConfig(options: LoadAgentLensConfigOptions = {}): AgentLensConfig {
	const cwd = options.cwd ?? process.cwd();
	const configFile = join(cwd, DEFAULT_CONFIG_FILE);
	const defaults = createDefaultConfig(cwd);
	if (!existsSync(configFile)) return defaults;

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(configFile, "utf8"));
	} catch (error) {
		return { ...defaults, source: configFile, warning: `Could not read Agent Lens config: ${formatError(error)}` };
	}

	if (!isObject(parsed)) {
		return { ...defaults, source: configFile, warning: "Agent Lens config must be a JSON object." };
	}

	const config: AgentLensConfig = { ...defaults, source: configFile };
	const warnings: string[] = [];

	if (typeof parsed.artifactRoot === "string" && parsed.artifactRoot.trim().length > 0) {
		config.artifactRoot = resolvePath(cwd, parsed.artifactRoot);
	}

	if (typeof parsed.liveReportRefreshSeconds === "number" && Number.isFinite(parsed.liveReportRefreshSeconds) && parsed.liveReportRefreshSeconds > 0) {
		config.liveReportRefreshSeconds = parsed.liveReportRefreshSeconds;
	}

	if (typeof parsed.captureProfile === "string" && parsed.captureProfile !== "redacted") {
		warnings.push(`unsupported captureProfile '${parsed.captureProfile}'; using redacted`);
	}

	if (isObject(parsed.retention)) {
		config.retention = {
			maxTraceFiles: readNullablePositiveInteger(parsed.retention.maxTraceFiles),
			maxAgeDays: readNullablePositiveInteger(parsed.retention.maxAgeDays),
		};
	}

	if (warnings.length > 0) config.warning = warnings.join("; ");
	return config;
}

function createDefaultConfig(cwd: string): AgentLensConfig {
	return {
		artifactRoot: join(cwd, ".pi-agent-lens"),
		liveReportRefreshSeconds: 2,
		captureProfile: "redacted",
		retention: { maxTraceFiles: null, maxAgeDays: null },
		source: "defaults",
	};
}

function resolvePath(cwd: string, value: string): string {
	return isAbsolute(value) ? value : join(cwd, value);
}

function readNullablePositiveInteger(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
