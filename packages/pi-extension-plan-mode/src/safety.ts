const PLAN_MODE_DEFAULT_TOOLS = ["read", "bash", "grep", "find", "ls"];
const PLAN_MODE_DISABLED_TOOLS = new Set(["edit", "write"]);

const DANGEROUS_PATTERNS = [
  /(^|\s)(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|chgrp|ln|tee|truncate|dd|shred)(\s|$)/i,
  /(^|\s)git\s+(add|commit|push|pull|merge|rebase|reset|checkout|switch|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)(\s|$)/i,
  /(^|\s)npm\s+(install|uninstall|update|ci|link|publish)(\s|$)/i,
  /(^|\s)(yarn|pnpm)\s+(add|remove|install|publish)(\s|$)/i,
  /(^|\s)pip\s+(install|uninstall)(\s|$)/i,
  /(^|\s)sudo(\s|$)/i,
  /(^|\s)(kill|pkill|killall|reboot|shutdown)(\s|$)/i,
  /(^|\s)(vim?|nano|emacs|code|subl)(\s|$)/i,
  /(^|[^<])>(?!>)/,
  />>/,
];

const AMBIGUOUS_SHELL_OPERATORS = [/;/, /&&/, /\|\|/, /\|/];

const READ_ONLY_PATTERNS = [
  /^\s*(pwd|ls|cat|head|tail|less|more|grep|rg|find|fd|wc|sort|uniq|diff|file|stat|du|df|tree|which|whereis|type|env|printenv|uname|whoami|id|date|ps)\b/i,
  /^\s*git\s+(status|log|diff|show|branch|remote)(\s|$)/i,
  /^\s*git\s+config\s+--get\b/i,
  /^\s*git\s+ls-/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit)(\s|$)/i,
  /^\s*(node|python|python3)\s+--version\b/i,
];

export function getPlanModeToolNames(activeToolNames: readonly string[]): string[] {
  return unique([...activeToolNames.filter((name) => !PLAN_MODE_DISABLED_TOOLS.has(name)), ...PLAN_MODE_DEFAULT_TOOLS]);
}

export function isReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) return false;
  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  if (AMBIGUOUS_SHELL_OPERATORS.some((pattern) => pattern.test(trimmed))) return false;
  return READ_ONLY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
