import assert from 'node:assert/strict';

const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function evictStaleJobs(jobs, now = Date.now()) {
  const cutoff = now - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}

{
  const now = Date.now();
  const jobs = new Map();
  jobs.set('old', { id: 'old', status: 'processing', createdAt: now - JOB_TTL_MS - 1, transcript: null, error: null });

  evictStaleJobs(jobs, now);
  assert.equal(jobs.has('old'), false);
}

{
  const now = Date.now();
  const jobs = new Map();
  jobs.set('fresh', { id: 'fresh', status: 'processing', createdAt: now - 1000, transcript: null, error: null });

  evictStaleJobs(jobs, now);
  assert.equal(jobs.has('fresh'), true);
}

{
  const now = Date.now();
  const jobs = new Map();
  jobs.set('old-1', { id: 'old-1', status: 'failed', createdAt: now - JOB_TTL_MS - 5000, transcript: null, error: 'x' });
  jobs.set('fresh-1', { id: 'fresh-1', status: 'processing', createdAt: now - 5000, transcript: null, error: null });
  jobs.set('old-2', { id: 'old-2', status: 'completed', createdAt: now - JOB_TTL_MS - 10, transcript: {}, error: null });
  jobs.set('fresh-2', { id: 'fresh-2', status: 'processing', createdAt: now, transcript: null, error: null });

  evictStaleJobs(jobs, now);
  assert.equal(jobs.has('old-1'), false);
  assert.equal(jobs.has('old-2'), false);
  assert.equal(jobs.has('fresh-1'), true);
  assert.equal(jobs.has('fresh-2'), true);
}

{
  const jobs = new Map();
  assert.doesNotThrow(() => evictStaleJobs(jobs, Date.now()));
}

console.log('tests/jobsMapCleanup.test.js: PASSED');
