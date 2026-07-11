export type SubagentName = "explorer" | "planner" | "reviewer";

export interface SubagentDefinition {
	name: SubagentName;
	description: string;
	mode: "plan" | "review";
	systemPrompt: string;
	readOnly: true;
	maxTurns: number;
	timeoutMs: number;
}

const DEFINITIONS: readonly SubagentDefinition[] = [
	{
		name: "explorer",
		description: "Inspect code and gather focused evidence.",
		mode: "review",
		systemPrompt: "Explore the requested code or evidence. Do not modify files. Return concrete findings with paths and concise uncertainty notes.",
		readOnly: true,
		maxTurns: 8,
		timeoutMs: 120_000,
	},
	{
		name: "planner",
		description: "Produce a bounded implementation plan.",
		mode: "plan",
		systemPrompt: "Plan the requested work from available evidence. Do not modify files. Return a concise ordered plan with verification steps and risks.",
		readOnly: true,
		maxTurns: 8,
		timeoutMs: 120_000,
	},
	{
		name: "reviewer",
		description: "Review code or decisions for concrete issues.",
		mode: "review",
		systemPrompt: "Review the requested scope critically. Do not modify files. Prioritize concrete correctness, safety, and test gaps with supporting evidence.",
		readOnly: true,
		maxTurns: 8,
		timeoutMs: 120_000,
	},
];

export function listSubagentDefinitions(): SubagentDefinition[] {
	return DEFINITIONS.map((definition) => ({ ...definition }));
}

export function getSubagentDefinition(name: string): SubagentDefinition | undefined {
	const definition = DEFINITIONS.find((candidate) => candidate.name === name);
	return definition ? { ...definition } : undefined;
}
