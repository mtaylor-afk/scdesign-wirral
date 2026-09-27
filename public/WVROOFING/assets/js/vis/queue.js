// WV Roofing Roof Visualiser — render queue with limited concurrency and
// whole-queue back-off when the service says "slow down" (HTTP 429).

export class RenderQueue {
  /**
   * @param {{concurrency:number, run:(job:object, signal:AbortSignal)=>Promise<any>,
   *          onChange:(job:object)=>void, onStop?:(err:Error)=>void}} opts
   */
  constructor(opts) {
    this.concurrency = Math.max(1, opts.concurrency || 2);
    this.runJob = opts.run;
    this.onChange = opts.onChange || (() => {});
    this.onStop = opts.onStop || (() => {});
    this.jobs = [];
    this.running = 0;
    this.pausedUntil = 0;
    this.stopped = false;
    this.timer = 0;
  }

  add(id, data) {
    const existing = this.jobs.find((j) => j.id === id);
    if (existing && (existing.state === "queued" || existing.state === "running" || existing.state === "done")) return existing;
    const job = { id, data, state: "queued", attempts: 0, error: null, result: null, started: 0, ctl: null };
    if (existing) this.jobs.splice(this.jobs.indexOf(existing), 1, job);
    else this.jobs.push(job);
    this.onChange(job);
    this.pump();
    return job;
  }

  /** Move a queued job to the front. */
  prioritise(id) {
    const i = this.jobs.findIndex((j) => j.id === id && j.state === "queued");
    if (i > 0) {
      const [job] = this.jobs.splice(i, 1);
      this.jobs.unshift(job);
    }
  }

  retry(id) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.state === "running" || job.state === "queued") return;
    job.state = "queued";
    job.error = null;
    job.attempts = 0;
    this.stopped = false;
    this.onChange(job);
    this.pump();
  }

  pauseFor(ms) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
    this.schedule(ms);
  }

  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.pump(), Math.max(50, ms));
  }

  stop(err) {
    this.stopped = true;
    for (const j of this.jobs) {
      if (j.state === "queued") {
        j.state = "stopped";
        this.onChange(j);
      }
    }
    this.onStop(err);
  }

  cancelAll() {
    clearTimeout(this.timer);
    for (const j of this.jobs) {
      if (j.ctl) j.ctl.abort();
      if (j.state === "queued" || j.state === "running") {
        j.state = "cancelled";
        this.onChange(j);
      }
    }
    this.jobs = [];
    this.running = 0;
  }

  counts() {
    const c = { queued: 0, running: 0, done: 0, error: 0, total: this.jobs.length };
    for (const j of this.jobs) if (c[j.state] !== undefined) c[j.state]++;
    return c;
  }

  pump() {
    if (this.stopped) return;
    const wait = this.pausedUntil - Date.now();
    if (wait > 0) return this.schedule(wait);
    while (this.running < this.concurrency) {
      const job = this.jobs.find((j) => j.state === "queued");
      if (!job) return;
      this.start(job);
    }
  }

  async start(job) {
    job.state = "running";
    job.started = Date.now();
    job.attempts++;
    job.ctl = new AbortController();
    this.running++;
    this.onChange(job);
    try {
      job.result = await this.runJob(job, job.ctl.signal);
      job.state = "done";
    } catch (err) {
      if (job.state === "cancelled" || (err && err.name === "AbortError")) {
        job.state = "cancelled";
      } else if (err && err.stopsQueue) {
        job.state = "error";
        job.error = err;
        this.running--;
        job.ctl = null;
        this.onChange(job);
        this.stop(err);
        return;
      } else if (err && err.status === 429 && job.attempts < 5) {
        job.state = "queued";
        this.jobs.splice(this.jobs.indexOf(job), 1);
        this.jobs.unshift(job);
        this.pauseFor((err.retryAfterMs || 8000) + Math.random() * 2000);
      } else if (err && err.retryable && job.attempts < 2) {
        job.state = "queued";
        this.pauseFor(4000 * job.attempts);
      } else {
        job.state = "error";
        job.error = err;
      }
    }
    job.ctl = null;
    this.running--;
    this.onChange(job);
    this.pump();
  }
}
