import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchJobs, fetchCandidate, triggerScrape, fetchApplyAllProgress } from '../api/jobsApi';
import StatsBar from './StatsBar';
import SearchBar from './SearchBar';
import JobList from './JobList';
import ApplyAllButton from './ApplyAllButton';
import CandidatePanel from './CandidatePanel';
import ScreenshotModal from './ScreenshotModal';
import CompanySelector from './CompanySelector';

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✅' : '❌'} {t.message}
        </div>
      ))}
    </div>
  );
}

function CaptchaAlertModal({ jobs, onDismiss }) {
  const job = jobs[0];
  if (!job) return null;
  const remaining = jobs.length - 1;

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🔐 CAPTCHA Detected — Manual Action Needed</span>
          <button className="modal-close" onClick={onDismiss}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            The automation stopped on <strong>{job.title}</strong> at <strong>{job.company}</strong> because
            the page presented a CAPTCHA or bot-protection challenge. Automated form filling cannot continue
            for this application.
          </p>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '10px 12px', borderRadius: '8px' }}>
            {job.failure_reason || 'CAPTCHA or bot protection detected'}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Open the posting yourself to solve the challenge and finish the application manually.
          </p>
          {remaining > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {remaining} more blocked application{remaining > 1 ? 's' : ''} queued.
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <a
              className="btn btn-primary btn-sm"
              href={job.application_url || job.job_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 Open Application
            </a>
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
              {remaining > 0 ? 'Next' : 'Dismiss'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [candidate, setCandidate] = useState(null);
  const [search, setSearch] = useState('');
  const [minMatch, setMinMatch] = useState(0);
  const [sortBy, setSortBy] = useState('match');
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [screenshotJob, setScreenshotJob] = useState(null);
  const [progress, setProgress] = useState({ running: false });
  const [allowSubmit, setAllowSubmit] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [captchaAlerts, setCaptchaAlerts] = useState([]);
  const notifiedCaptchaIds = useRef(new Set());
  const firstJobsLoad = useRef(true);

  function addToast(message, type = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // ── Load jobs (polling) ───────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs();
      const nextJobs = data.jobs || [];
      setJobs(nextJobs);
      setStats(data.stats || {});

      const blocked = nextJobs.filter((j) => j.status === 'MANUAL_INTERVENTION_REQUIRED');
      if (firstJobsLoad.current) {
        // Don't replay alerts for jobs already blocked before this session started
        blocked.forEach((j) => notifiedCaptchaIds.current.add(j.id));
        firstJobsLoad.current = false;
      } else {
        const fresh = blocked.filter((j) => !notifiedCaptchaIds.current.has(j.id));
        if (fresh.length > 0) {
          fresh.forEach((j) => notifiedCaptchaIds.current.add(j.id));
          setCaptchaAlerts((prev) => [...prev, ...fresh]);
        }
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load candidate profile ─────────────────────────────────────────────────
  useEffect(() => {
    fetchCandidate().then(setCandidate).catch(() => { });
  }, []);

  // ── Initial load + 3-second polling loop ──────────────────────────────────
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  // ── Poll apply-all progress ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const p = await fetchApplyAllProgress();
        setProgress(p);
      } catch (_) { }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Scrape handler ────────────────────────────────────────────────────────
  async function handleScrape(boards = null) {
    setScraping(true);
    try {
      await triggerScrape(boards);
      const msg = Array.isArray(boards)
        ? `Multi-company scraping started for ${boards.length} boards!`
        : 'Multi-company scraping started!';
      addToast(msg, 'success');
      setTimeout(loadJobs, 2500);
      setTimeout(loadJobs, 6000);
      setTimeout(loadJobs, 12000);
    } catch (e) {
      addToast('Scrape failed: ' + e.message, 'error');
    } finally {
      setScraping(false);
    }
  }

  // ── Search & Relevancy filter (client-side) ────────────────────────────────
  const filteredJobs = jobs
    .filter((j) => {
      const q = search.toLowerCase();
      const matchScore = Number(j.match_score || 0);

      if (minMatch > 0 && matchScore < minMatch) {
        return false;
      }

      return (
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q) ||
        j.company_board?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'match') {
        return Number(b.match_score || 0) - Number(a.match_score || 0);
      }
      if (sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      // 'newest' fallback
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="app-container header-inner">
          <div className="header-logo">
            <div className="header-logo-icon">🤖</div>
            <div>
              <div className="header-title">JobBot Dashboard</div>
              <div className="header-subtitle">Multi-Company Job Scraper & Auto-Apply Engine</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              id="scrape-btn"
              className="btn btn-ghost btn-sm"
              onClick={() => handleScrape()}
              disabled={scraping}
            >
              {scraping ? <><span className="spinner" /> Scraping...</> : '🕷️ Scrape All Presets'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main>
        <div className="app-container">
          {/* Hero */}
          <section className="hero">
            <h1 className="hero-heading">
              <span className="gradient-text">Auto-Apply</span> Dashboard
            </h1>
            <p className="hero-sub">
              Scrape top Greenhouse company boards, rank jobs by resume match score, and apply hands-free.
            </p>
            <StatsBar stats={stats} />
          </section>

          {/* Candidate Panel */}
          <CandidatePanel
            candidate={candidate}
            onResumeUploaded={(updated) => {
              if (updated) {
                setCandidate(updated);
                addToast(`Profile updated & job match scores recalculated for ${updated.firstName} ${updated.lastName}!`, 'success');
                setTimeout(loadJobs, 1000);
              } else {
                fetchCandidate().then(setCandidate).catch(() => { });
              }
            }}
            onCandidateUpdated={(updated) => {
              setCandidate(updated);
              addToast('Candidate profile & EEO answers saved! Match scores recalculated.', 'success');
              setTimeout(loadJobs, 1000);
            }}
          />

          {/* Multi-Company Scraper Board Selector */}
          <CompanySelector onScrape={handleScrape} scraping={scraping} />

          {/* Controls Bar with Relevancy Filters & Real Submission Mode Toggle */}
          <div className="controls-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <SearchBar value={search} onChange={setSearch} />

            {/* Relevancy Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Match:</span>
              <select
                value={minMatch}
                onChange={(e) => setMinMatch(Number(e.target.value))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <option value={0}>🎯 All Matches</option>
                <option value={75}>🔥 High Match (≥ 75%)</option>
                <option value={50}>⚡ Medium Match (≥ 50%)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <option value="match">🏆 Highest Match Score</option>
                <option value="newest">🕒 Newest First</option>
                <option value="company">🏢 Company Name</option>
              </select>
            </div>

            {/* Mode Selector Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                marginLeft: 'auto',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Mode:</span>
              <button
                type="button"
                className={`btn btn-sm ${!allowSubmit ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setAllowSubmit(false)}
              >
                🛡️ Proof Only (Safe)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${allowSubmit ? 'btn-danger' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => {
                  setAllowSubmit(true);
                  addToast('Real Submission Mode active! Bot WILL submit applications.', 'error');
                }}
              >
                ⚡ Real Submission
              </button>
            </div>

            {(() => {
              const eligibleJobIds = filteredJobs
                .filter((j) => j.status === 'NOT_STARTED' || j.status === 'FAILED')
                .map((j) => j.id);

              return (
                <ApplyAllButton
                  eligibleJobIds={eligibleJobIds}
                  stats={stats}
                  progress={progress}
                  allowSubmit={allowSubmit}
                  onStarted={() =>
                    addToast(
                      allowSubmit
                        ? `Apply-all started for ${eligibleJobIds.length} filtered job(s) in REAL SUBMIT mode!`
                        : `Apply-all started for ${eligibleJobIds.length} filtered job(s) in Proof-only mode!`,
                      'success'
                    )
                  }
                />
              );
            })()}
          </div>

          {/* Job Grid */}
          {loading ? (
            <div className="loading-screen">
              <div className="loading-spinner" />
              <p>Loading jobs...</p>
            </div>
          ) : (
            <JobList
              jobs={filteredJobs}
              candidate={candidate}
              allowSubmit={allowSubmit}
              onApplyStart={(id) =>
                addToast(
                  allowSubmit
                    ? `Applying & Submitting job ${id}`
                    : `Form filling & screenshotting job ${id}`,
                  'success'
                )
              }
              onScreenshot={setScreenshotJob}
            />
          )}
        </div>
      </main>

      {/* ── Screenshot Modal ─────────────────────────────────────────────────── */}
      {screenshotJob && (
        <ScreenshotModal
          job={screenshotJob}
          onClose={() => setScreenshotJob(null)}
        />
      )}

      {/* ── CAPTCHA Alert Popup ──────────────────────────────────────────────── */}
      {captchaAlerts.length > 0 && (
        <CaptchaAlertModal
          jobs={captchaAlerts}
          onDismiss={() => setCaptchaAlerts((prev) => prev.slice(1))}
        />
      )}

      {/* ── Toasts ────────────────────────────────────────────────────────────── */}
      <Toast toasts={toasts} />
    </>
  );
}
