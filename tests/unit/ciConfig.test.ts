import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Story 1.35: CI fails on high-severity production vulnerabilities.
// No YAML parser is a dependency, so these checks read the files as text and
// rely on the two-space indentation the workflow files already use.

const root = path.join(__dirname, '..', '..');
const ciYml = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf-8');
const dependabotYml = fs.readFileSync(path.join(root, '.github', 'dependabot.yml'), 'utf-8');

/** Splits the `jobs:` block of a workflow into { jobKey: jobBody }. */
function jobsOf(workflow: string): Record<string, string> {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l === 'jobs:');
  const jobs: Record<string, string> = {};
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    const key = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (key) {
      current = key[1];
      jobs[current] = '';
    } else if (/^\S/.test(line)) {
      break;
    } else if (current) {
      jobs[current] += line + '\n';
    }
  }
  return jobs;
}

/** Splits a block list (`  - ...` at a given indent) into its items. */
function listItems(block: string, indent: number): string[] {
  const marker = new RegExp(`^ {${indent}}- `);
  const items: string[] = [];
  for (const line of block.split('\n')) {
    if (marker.test(line)) items.push(line + '\n');
    else if (items.length > 0) items[items.length - 1] += line + '\n';
  }
  return items;
}

describe('ci.yml production audit (Story 1.35)', () => {
  const jobs = jobsOf(ciYml);

  it('keeps the required check job keys', () => {
    for (const required of ['typecheck', 'vitest', 'playwright-gate']) {
      expect(Object.keys(jobs)).toContain(required);
    }
  });

  it('gives no job a job-level name', () => {
    for (const body of Object.values(jobs)) {
      expect(body).not.toMatch(/^ {4}name:/m);
    }
  });

  it('runs pnpm audit --prod --audit-level=high as a step inside an existing job', () => {
    const auditSteps = Object.values(jobs).flatMap((body) =>
      listItems(body, 6).filter((step) => /run:.*pnpm audit --prod --audit-level=high/.test(step)),
    );
    expect(auditSteps.length).toBeGreaterThan(0);
  });

  it('runs the audit unconditionally in a required job, after installing deps', () => {
    const gating = ['typecheck', 'vitest'].filter((key) => {
      const steps = listItems(jobs[key] ?? '', 6);
      const audit = steps.findIndex((s) => /pnpm audit --prod --audit-level=high/.test(s));
      const install = steps.findIndex((s) => /pnpm install --frozen-lockfile/.test(s));
      return audit > install && install >= 0 && !/^ {8}if:/m.test(steps[audit]);
    });
    expect(gating.length).toBeGreaterThan(0);
  });

  it('never masks a failing step', () => {
    expect(ciYml).not.toContain('|| true');
    expect(ciYml).not.toContain('--if-present');
    expect(ciYml).not.toMatch(/continue-on-error:\s*true/);
  });
});

describe('dependabot.yml (Story 1.35)', () => {
  // Owner decision 2026-11-21: npm updates stay daily; dev dependencies land
  // as one grouped PR per run.
  it('groups development-dependency updates into one PR on the daily schedule', () => {
    const npm = listItems(dependabotYml, 2).find((u) => /package-ecosystem:\s*npm/.test(u));
    expect(npm).toBeDefined();
    expect(npm).toMatch(/interval:\s*daily/);
    expect(npm).toMatch(/dependency-type:\s*development/);
  });
});
