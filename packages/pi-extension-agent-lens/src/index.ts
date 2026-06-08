import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeCleanupPlan, formatCleanupPlan, planCleanup } from "./cleanup.ts";
import { formatReportMessage, formatStatusMessage, parseAgentLensCommand } from "./commands.ts";
import { loadAgentLensConfig } from "./config.ts";
import { contentFingerprint } from "./redact.ts";
import { writeIndexReport } from "./index-report.ts";
import { writeHtmlReportForTrace } from "./report.ts";
import {
	summarizeBeforeAgentStart,
	summarizeCompactionPreparation,
	summarizeMessages,
	summarizeProviderPayload,
} from "./summarize.ts";
import { createTraceRecorder } from "./trace.ts";
import { formatTraceList, listTraceSummaries } from "./traces.ts";

/**
 * Agent Lens extension entry point.
 *
 * M1 records read-only lifecycle metadata to local JSONL artifacts. Handlers
 * intentionally return nothing so pi's context, provider payloads, and
 * compaction behavior stay unchanged.
 */
export default function agentLens(pi: ExtensionAPI): void {
	const config = loadAgentLensConfig();
	const recorder = createTraceRecorder({ artifactRoot: config.artifactRoot });
	let runIndex = 0;
	let liveReportRefreshSeconds: number | undefined;

	const record = (event: string, data: unknown): void => {
		void recorder.record(event, data)
			.then(async () => {
				if (liveReportRefreshSeconds) {
					await writeHtmlReportForTrace(recorder.traceFile, {
						refreshSeconds: liveReportRefreshSeconds,
						writeLatestAlias: true,
					});
				}
			})
			.catch((error) => {
				recorder.lastError = error instanceof Error ? error.message : String(error);
			});
	};

	pi.registerCommand("agent-lens", {
		description: "Show Agent Lens trace status, list traces, or generate a local report",
		handler: async (args, ctx) => {
			const command = parseAgentLensCommand(args);
			if (command === "report") {
				liveReportRefreshSeconds = config.liveReportRefreshSeconds;
				await recorder.record("report_requested", { runIndex });
				const reportFile = await writeHtmlReportForTrace(recorder.traceFile, {
					refreshSeconds: liveReportRefreshSeconds,
					writeLatestAlias: true,
				});
				ctx.ui.notify(formatReportMessage(reportFile, join(dirname(recorder.traceFile), "latest.html")), "info");
				return;
			}
			if (command === "traces") {
				const summaries = await listTraceSummaries(dirname(recorder.traceFile));
				ctx.ui.notify(formatTraceList(summaries, { activeTraceFile: recorder.traceFile }), "info");
				return;
			}
			if (command === "index") {
				const indexFile = await writeIndexReport({ artifactRoot: config.artifactRoot, activeTraceFile: recorder.traceFile });
				ctx.ui.notify(`Agent Lens index: ${indexFile}`, "info");
				return;
			}
			if (command === "clean_dry_run" || command === "clean_confirm") {
				const plan = await planCleanup({
					artifactRoot: config.artifactRoot,
					activeTraceFile: recorder.traceFile,
					retention: config.retention,
				});
				if (command === "clean_confirm") {
					await executeCleanupPlan(plan);
					ctx.ui.notify(`Deleted ${plan.deleteFiles.length} Agent Lens cleanup ${plan.deleteFiles.length === 1 ? "file" : "files"}.`, "info");
					return;
				}
				ctx.ui.notify(formatCleanupPlan(plan), "info");
				return;
			}

			ctx.ui.notify(
				formatStatusMessage({
					traceFile: recorder.traceFile,
					rawCaptureEnabled: false,
					liveReportEnabled: liveReportRefreshSeconds !== undefined,
					latestReportFile: join(dirname(recorder.traceFile), "latest.html"),
					configSource: config.source,
					captureProfile: config.captureProfile,
					configWarning: config.warning,
					lastError: recorder.lastError,
				}),
				recorder.lastError || config.warning ? "warning" : "info",
			);
		},
	});

	pi.on("before_agent_start", (event) => {
		runIndex += 1;
		record("before_agent_start", { runIndex, ...summarizeBeforeAgentStart(event) });
	});

	pi.on("agent_start", () => {
		record("agent_start", { runIndex });
	});

	pi.on("agent_end", (event) => {
		record("agent_end", { runIndex, messages: summarizeMessages(event.messages) });
	});

	pi.on("turn_start", (event) => {
		record("turn_start", { runIndex, turnIndex: event.turnIndex, timestamp: event.timestamp });
	});

	pi.on("turn_end", (event) => {
		record("turn_end", {
			runIndex,
			turnIndex: event.turnIndex,
			assistant: summarizeMessages([event.message]),
			toolResults: summarizeMessages(event.toolResults),
		});
	});

	pi.on("context", (event) => {
		record("context", { runIndex, messages: summarizeMessages(event.messages) });
	});

	pi.on("before_provider_request", (event) => {
		record("before_provider_request", { runIndex, payload: summarizeProviderPayload(event.payload) });
	});

	pi.on("session_before_compact", (event) => {
		record("session_before_compact", {
			runIndex,
			customInstructions: contentFingerprint(event.customInstructions),
			branchEntryCount: event.branchEntries.length,
			preparation: summarizeCompactionPreparation(event.preparation),
		});
	});

	pi.on("session_compact", (event) => {
		record("session_compact", {
			runIndex,
			fromExtension: event.fromExtension,
			compaction: {
				id: event.compactionEntry.id,
				parentId: event.compactionEntry.parentId,
				firstKeptEntryId: event.compactionEntry.firstKeptEntryId,
				tokensBefore: event.compactionEntry.tokensBefore,
				summary: contentFingerprint(event.compactionEntry.summary),
				detailKeys: event.compactionEntry.details ? Object.keys(event.compactionEntry.details).sort() : [],
			},
		});
	});
}
