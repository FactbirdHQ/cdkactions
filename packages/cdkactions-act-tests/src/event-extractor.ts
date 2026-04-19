import * as yaml from 'js-yaml';
import { readFileSync } from 'node:fs';

const SKIPPED_EVENTS = new Set(['workflow_call', 'workflow_run']);

export function extractEvents(workflowPath: string): string[] {
  const content = readFileSync(workflowPath, 'utf-8');
  const doc = yaml.load(content) as Record<string, unknown>;
  const on = doc['on'] ?? doc['true'];

  if (typeof on === 'string') {
    return filterEvents([on]);
  }

  if (Array.isArray(on)) {
    return filterEvents(on);
  }

  if (typeof on === 'object' && on !== null) {
    return filterEvents(Object.keys(on));
  }

  return [];
}

function filterEvents(events: string[]): string[] {
  return events.filter((e) => !SKIPPED_EVENTS.has(e));
}
