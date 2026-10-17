import { execFileSync } from 'node:child_process';

// Fresh processes verify import side effects even when other specs have already
// imported the cron modules. Timers and job starts are observed, never executed.
function runStartupCheck(source) {
  return execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 15000
  });
}

const observeJobs = `
  import assert from 'node:assert/strict';
  import { CronJob } from 'cron';
  const starts = [];
  CronJob.prototype.start = function () { starts.push(this); };
`;

const applicationStartup = `
  const { startJobs } = await import('./server/services/cron.js');
  const { startBlockJobs } = await import('./server/services/blockService.js');
  assert.equal(starts.length, 0, 'Importing the coordinator must not start jobs');
  startBlockJobs();
  const inactivityJob = starts.pop();
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const app = readFileSync('app.js', 'utf8');
  const begin = app.indexOf("if (['1', 'true', 'yes', 'on'].includes(");
  const end = app.indexOf('const app = express();', begin);
  assert.ok(begin >= 0 && end > begin, 'Locate the actual application startup gate');
  const startup = app.slice(begin, end);
  const timers = [];
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay) => { timers.push(delay); return 0; };
  function exercise(flag) {
    starts.length = 0;
    timers.length = 0;
    const env = { NODE_ENV: 'production' };
    if (flag !== undefined) env.DISABLE_BACKGROUND_JOBS = flag;
    runInNewContext(startup, { process: { env }, console: { warn() {} }, startJobs });
  }
`;

describe('inactivity job startup', () => {
  it('does no work on import and starts the existing scheduled job explicitly', () => {
    expect(() => runStartupCheck(observeJobs + `
      const { startBlockJobs } = await import('./server/services/blockService.js');
      assert.equal(starts.length, 0);
      startBlockJobs();
      assert.equal(starts.length, 1);
      assert.equal(starts[0].cronTime.source, '*/5 * * * *');
      assert.equal(starts[0].cronTime.zone, 'UTC');
    `)).not.toThrow();
  });

  it('starts the inactivity job through normal production application startup', () => {
    expect(() => runStartupCheck(observeJobs + applicationStartup + `
      try {
        for (const flag of [undefined, 'false', '0']) {
          exercise(flag);
          assert.equal(starts.filter(job => job === inactivityJob).length, 1);
          assert.ok(starts.length > 1, 'The other production jobs still start');
          assert.deepEqual(timers, [1000], 'Startup cache warming is still scheduled');
        }
      } finally { globalThis.setTimeout = realTimeout; }
    `)).not.toThrow();
  });

  it('keeps all jobs stopped when the application disable flag is enabled', () => {
    expect(() => runStartupCheck(observeJobs + applicationStartup + `
      try {
        for (const flag of ['1', 'true', 'yes', 'on', ' TRUE ']) {
          exercise(flag);
          assert.equal(starts.length, 0);
          assert.equal(timers.length, 0);
        }
      } finally { globalThis.setTimeout = realTimeout; }
    `)).not.toThrow();
  });
});
