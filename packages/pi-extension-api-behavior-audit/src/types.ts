export type ApiCaptureLayer = "browser-visible" | "upstream";
export type ApiSide = "old" | "new";
export type ApiCaptureSource = "playwright" | "recording-proxy";
export type ScenarioType = "read-only";

export interface CandidatePageContext {
  url: string;
  path: string;
  source: string;
}

export interface BrowserVisibleApiObservation {
  method: string;
  url: string;
  path: string;
  status: number;
  source: string;
}

export interface ComparisonRunBrowserContextArtifact {
  page?: CandidatePageContext;
  browserVisibleRequests?: BrowserVisibleApiObservation[];
}

export interface ComparisonRunTargetArtifact {
  targetId: string;
  side: ApiSide;
  variant?: string;
  runId: string;
  manifestPath: string;
  exchangesPath?: string;
  browserContext?: ComparisonRunBrowserContextArtifact;
}

export interface ComparisonRunArtifact {
  version: 1;
  kind: "api-behavior-comparison-run";
  comparisonRunId: string;
  candidateScenarioId: string;
  discoverySessionId?: string;
  createdAt: string;
  updatedAt?: string;
  targets: Record<string, ComparisonRunTargetArtifact>;
}

export interface EndpointStatusSummary {
  [status: string]: number;
}

export interface EndpointAnalysisSummary {
  method: string;
  path: string;
  count: number;
  statuses: EndpointStatusSummary;
  responseTopLevelKeys?: string[];
  classificationHints: string[];
}

export interface ComparisonTargetAnalysis {
  targetId: string;
  side: ApiSide;
  variant?: string;
  runId: string;
  page?: CandidatePageContext;
  upstream: { endpointSummary: EndpointAnalysisSummary[] };
  browserVisible: { endpointSummary: EndpointAnalysisSummary[] };
}

export interface ComparisonAnalysisArtifact {
  version: 1;
  kind: "api-behavior-comparison-analysis";
  comparisonRunId: string;
  candidateScenarioId: string;
  generatedAt: string;
  targets: Record<string, ComparisonTargetAnalysis>;
}

export interface CaptureScenario {
  id: string;
  feature: string;
  description: string;
  type: ScenarioType;
  layer: ApiCaptureLayer;
  page: {
    oldPath: string;
    newPath: string;
  };
  apiAllowlist: {
    old: string[];
    new: string[];
  };
  notes?: string[];
}

export interface ScenarioManifest {
  version: 1;
  scenarios: CaptureScenario[];
}

export interface ApiExchange {
  runId: string;
  layer: ApiCaptureLayer;
  side: ApiSide;
  scenarioId: string;
  targetId?: string;
  variant?: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, unknown>;
    body: unknown;
  };
  timing: {
    startedAt: string;
    durationMs: number;
  };
  provenance: {
    source: ApiCaptureSource;
    pageUrl?: string;
  };
}

export interface CaptureManifest {
  runId: string;
  createdAt: string;
  artifactVersion: 1;
  redaction: {
    marker: string;
    policy: string;
  };
  scenarios: string[];
  layer?: ApiCaptureLayer;
  purpose?: string;
  candidateScenarioId?: string;
  discoverySessionId?: string;
  comparisonRunId?: string;
  recordingWindow?: {
    startedAt: string;
    finishedAt?: string;
  };
  candidatePage?: CandidatePageContext;
  browserVisibleRequests?: BrowserVisibleApiObservation[];
  targets?: {
    oldBaseUrl: string;
    newBaseUrl: string;
  };
  startedAt?: string;
  finishedAt?: string;
  exchangeCount?: number;
  recording?: boolean;
  scenarioSnapshots?: CaptureScenario[];
  recordingProxy?: {
    side: ApiSide;
    listenUrl: string;
    targetBaseUrl: string;
    scenarioId: string;
    targetId?: string;
    variant?: string;
  };
  notes?: string[];
}
