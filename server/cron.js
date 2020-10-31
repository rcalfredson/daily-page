const { CronJob } = require('cron');
const { cleanUpOldPeerIds } = require('./mongo')

var jobs = [new CronJob('3 * * * *', async () => {
  await cleanUpOldPeerIds();
}, null)];

function startJobs() {
  jobs.forEach(job => {
    job.start();
  })
}

module.exports = {
  startJobs
};