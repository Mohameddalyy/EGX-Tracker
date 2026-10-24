// Compatibility command: durable independent source jobs replace the all-or-stop chain.
// Remains manual while schedules are paused; unresolved source permissions block collection.
import {workflowCommand} from './workflow-agent.mjs';
await workflowCommand(['run','baseline',...process.argv.slice(2)]);
