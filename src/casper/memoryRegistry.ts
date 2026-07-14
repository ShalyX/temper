import { randomUUID } from "node:crypto";
import type { Registry } from "../core/harness.js";
import type { RegistryEntry } from "../core/types.js";

export function createMemoryRegistry(): Registry {
  const entries: RegistryEntry[] = [];

  return {
    async record(partial) {
      const entry: RegistryEntry = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...partial,
        mode: partial.mode ?? "memory",
      };
      entries.push(entry);
      return entry;
    },
    async list() {
      return [...entries];
    },
  };
}
