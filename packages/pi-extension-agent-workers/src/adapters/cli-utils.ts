import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

export type CommandAvailabilityCheck = (command: string) => boolean;

export function isCommandAvailable(command: string): boolean {
  if (isAbsolute(command)) return canExecute(command);

  const pathEntries = process.env.PATH?.split(delimiter) ?? [];
  return pathEntries.some((entry) => canExecute(join(entry, command)));
}

function canExecute(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
