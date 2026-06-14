export type AgentLensCommand = "status" | "report" | "traces" | "index" | "compare" | "clean_dry_run" | "clean_confirm";

export interface AgentLensStatus {
	traceFile: string;
	rawCaptureEnabled: boolean;
	liveReportEnabled?: boolean;
	latestReportFile?: string;
	configSource?: string;
	captureProfile?: string;
	configWarning?: string;
	lastError?: string;
}

export function parseAgentLensCommand(args: string): AgentLensCommand {
	const command = args.trim();
	if (command === "report") return "report";
	if (command === "traces") return "traces";
	if (command === "index") return "index";
	if (command === "compare") return "compare";
	if (command === "clean --dry-run") return "clean_dry_run";
	if (command === "clean --confirm") return "clean_confirm";
	return "status";
}

export function formatStatusMessage(status: AgentLensStatus): string {
	const lines = [
		`Agent Lens trace: ${status.traceFile}`,
		`raw capture: ${status.rawCaptureEnabled ? "enabled" : "disabled"}`,
		`live report: ${status.liveReportEnabled ? "enabled" : "disabled"}`,
	];
	if (status.latestReportFile) {
		lines.push(`latest report: ${status.latestReportFile}`);
	}
	if (status.configSource) {
		lines.push(`config source: ${status.configSource}`);
	}
	if (status.captureProfile) {
		lines.push(`capture profile: ${status.captureProfile}`);
	}
	if (status.configWarning) {
		lines.push(`config warning: ${status.configWarning}`);
	}
	if (status.lastError) {
		lines.push(`last error: ${status.lastError}`);
	}
	return lines.join("\n");
}

export function formatReportMessage(reportFile: string, latestReportFile?: string): string {
	const lines = [`Agent Lens report: ${reportFile}`];
	if (latestReportFile) lines.push(`Latest report: ${latestReportFile}`);
	return lines.join("\n");
}
