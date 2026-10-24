const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cairo = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', {timeZone:'Africa/Cairo',dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : 'Unavailable';
export function paperOperations(state, performance, audit) {
 const events = audit.events || [], runs = events.filter(e => e.kind === 'run').map(e => e.payload);
 const checks = events.filter(e => e.kind === 'preflight').at(-1)?.payload.checks || [];
 const coverage = performance.researchCoverage || {}, operations = performance.operations;
 const lastCapture = events.filter(e => e.kind === 'capture').at(-1);
 return `<div class="levels-context"><h3>Operational status — ${state.preflightReady ? 'entry checks passed' : 'entries blocked'}</h3>
 <p>Recorded checkpoints: ${operations.completedCheckpoints} · Blocked: ${operations.blockedCheckpoints} · Missing due checkpoints: ${operations.missing.length} · More than 15 minutes late: ${operations.late.length}</p>
 <p>Orders proposed: ${audit.orders.length} · Fills: ${audit.fills.length}. A recorded checkpoint is not a completed market review.</p>
 <p>Last minute capture: ${cairo(lastCapture?.at)} Cairo. Last screen: ${cairo(coverage.lastScreenAt)} Cairo. These are evidence timestamps, not proof of current coverage.</p>
 <h3>Why entries are blocked</h3>${checks.length ? checks.map(c => `<details open><summary>${esc(c.name)}: ${esc(c.status)}${Date.now()-Date.parse(c.checkedAt)>36*3600000 ? ' — expired' : ''} · ${cairo(c.checkedAt)} Cairo</summary><p>${esc(c.evidence)}</p></details>`).join('') : '<p>No preflight evidence recorded.</p>'}
 <h3>Research pipeline</h3><p>Catalog: ${esc(coverage.catalog)} · Latest screen matches: ${coverage.screenMatches?.length ?? 'Unavailable'}. Screening is not full research.</p>
 <p>${(coverage.researchQueue || []).map(q => `${esc(q.status)}: ${q.count}`).join(' · ') || 'No queued reviews'}</p><p>${(coverage.currentDecisions || []).map(d => `${esc(d.action)}: ${d.count}`).join(' · ') || 'No final decisions'}</p>
 <h3>Actual checkpoint times (Cairo)</h3><table><thead><tr><th>Checkpoint</th><th>Started</th><th>Entry checks</th></tr></thead><tbody>${runs.slice().reverse().map(r => `<tr><td>${esc(r.id)}</td><td>${cairo(r.startedAt)}</td><td>${r.preflightReady ? 'Passed' : 'Blocked'}</td></tr>`).join('')}</tbody></table>
 <details><summary>Missing due checkpoints (${operations.missing.length})</summary>${operations.missing.map(m => `<p>${esc(m.day)} · ${esc(m.phase)} · ${cairo(m.scheduledAt)} Cairo — calendar or execution failure needs verification</p>`).join('')}</details></div>`;
}
