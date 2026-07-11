import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { discoverAgentWorkerProtocol, requestAgentWorkerProtocol } from "@gregho/pi-extension-agent-workers/protocol";
import { Type } from "typebox";

import { executeSubagentCalls, type SubagentParams } from "./subagent.ts";

interface ToolContextLike {
	cwd?: string;
	hasUI?: boolean;
	ui?: {
		confirm?(title: string, message: string): Promise<boolean>;
	};
}

export default function subagentsExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Run 1-4 bounded read-only subagent calls in parallel and return foreground results in input order.",
		promptSnippet: "Delegate focused read-only exploration, planning, or review to foreground subagents",
		promptGuidelines: [
			"Use subagent for bounded parallel read-only exploration, planning, or review when independent child context helps.",
			"Do not use subagent for writes, background work, nested delegation, retries, or team coordination.",
		],
		parameters: Type.Object({
			calls: Type.Array(Type.Object({
				agent: StringEnum(["explorer", "planner", "reviewer"] as const),
				task: Type.String({ minLength: 1, maxLength: 8000 }),
			}), { minItems: 1, maxItems: 4 }),
			cwd: Type.Optional(Type.String({ description: "Common child working directory. Defaults to the current pi cwd." })),
		}),
		async execute(_toolCallId, params: SubagentParams, _signal, _onUpdate, ctx: ToolContextLike) {
			try {
				const result = await executeSubagentCalls({ ...params, cwd: params.cwd ?? ctx.cwd }, {
					protocol: {
						discover: () => discoverAgentWorkerProtocol(pi.events, { timeoutMs: 1000 }),
						request: (operation, payload, options) => requestAgentWorkerProtocol(pi.events, operation, payload, options),
					},
					confirm: async () => {
						if (ctx.hasUI === false || !ctx.ui?.confirm) return false;
						return ctx.ui.confirm(
							"Run read-only subagents?",
							`Start ${params.calls.length} foreground Pi SDK child session(s) with read-only tools?`,
						);
					},
				});
				if (result.cancelled) return toolResult("Canceled: subagent delegation was not confirmed.", result);
				const failures = result.results.filter((item) => item.error).length;
				return toolResult(`Completed ${result.results.length - failures}/${result.results.length} subagent call(s).`, result);
			} catch (error) {
				return toolResult(error instanceof Error ? error.message : String(error), {
					cancelled: false,
					results: [],
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
	});
}

function toolResult(content: string, details: object) {
	return { content: [{ type: "text" as const, text: content }], details };
}
