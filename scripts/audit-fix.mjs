#!/usr/bin/env node
// Moves every package that `pnpm audit` flags to a patched version inside the
// ranges package.json already allows (`pnpm update <names>`), then audits again.
//
// Used by .github/workflows/audit-fix.yml; also safe to run by hand.
// Writes a Markdown summary to $AUDIT_SUMMARY (if set) and `remaining=<n>` to
// $GITHUB_OUTPUT (if set). Exits non-zero only when pnpm itself fails, so the
// workflow can still open a PR for a partial fix before reporting what is left.
import { spawnSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'

function audit() {
  const res = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  // pnpm audit exits 1 when it finds advisories; anything unparsable is a real failure.
  let report
  try {
    report = JSON.parse(res.stdout)
  } catch {
    process.stderr.write(res.stderr || res.stdout || 'pnpm audit produced no output\n')
    throw new Error(`pnpm audit failed (exit ${res.status})`)
  }
  if (report.error) throw new Error(`pnpm audit failed: ${JSON.stringify(report.error)}`)
  return Object.values(report.advisories ?? {})
}

function line(a) {
  return `| ${a.severity} | \`${a.module_name}\` | ${a.vulnerable_versions} | ${a.patched_versions} | [${a.title}](${a.url}) |`
}

function table(advisories) {
  if (advisories.length === 0) return '_none_\n'
  const order = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 }
  const rows = [...advisories].sort(
    (x, y) => (order[x.severity] ?? 9) - (order[y.severity] ?? 9) || x.module_name.localeCompare(y.module_name),
  )
  return ['| Severity | Package | Vulnerable | Patched | Advisory |', '|---|---|---|---|---|', ...rows.map(line)].join('\n') + '\n'
}

const before = audit()
let after = before

if (before.length > 0) {
  const names = [...new Set(before.map((a) => a.module_name))].sort()
  console.log(`pnpm audit: ${before.length} advisories in ${names.join(', ')}`)
  const upd = spawnSync('pnpm', ['update', ...names], { stdio: 'inherit' })
  if (upd.status !== 0) throw new Error(`pnpm update failed (exit ${upd.status})`)
  after = audit()
}

const remainingIds = new Set(after.map((a) => a.id))
const fixed = before.filter((a) => !remainingIds.has(a.id))
console.log(`fixed ${fixed.length}, remaining ${after.length}`)

if (process.env.AUDIT_SUMMARY) {
  const summary = [
    `Automated run of \`scripts/audit-fix.mjs\` (\`pnpm update\` on every package \`pnpm audit\` flags, within the ranges in package.json).`,
    '',
    `**pnpm audit: ${before.length} → ${after.length}**`,
    '',
    `### Fixed (${fixed.length})`,
    table(fixed),
    `### Still open (${after.length})`,
    after.length
      ? 'These need a range bump in package.json (or an upstream release), so they are left for a person:\n\n' + table(after)
      : '_none_\n',
  ].join('\n')
  writeFileSync(process.env.AUDIT_SUMMARY, summary)
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `remaining=${after.length}\n`)
