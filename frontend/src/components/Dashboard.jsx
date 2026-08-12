import { useState, useEffect, useCallback } from 'react';
import { fetchJobs, fetchCandidate, triggerScrape, fetchApplyAllProgress } from '../api/jobsApi';
import StatsBar from './StatsBar';
import SearchBar from './SearchBar';
import JobList from './JobList';
import ApplyAllButton from './ApplyAllButton';
import CandidatePanel from './CandidatePanel';
import ScreenshotModal from './ScreenshotModal';

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

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [candidate, setCandidate] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [screenshotJob, setScreenshotJob] = useState(null);
  const [progress, setProgress] = useState({ running: false });
  const [allowSubmit, setAllowSubmit] = useState(false);
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // ── Load jobs (polling) ───────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data.jobs || []);
      setStats(data.stats || {});
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load candidate profile ─────────────────────────────────────────────────
  useEffect(() => {
    fetchCandidate().then(setCandidate).catch(() => {});
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
      } catch (_) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Scrape handler ────────────────────────────────────────────────────────
  async function handleScrape() {
    setScraping(true);
    try {
      await triggerScrape();
      addToast('Scraping started! Jobs will appear shortly.', 'success');
      setTimeout(loadJobs, 2000);
      setTimeout(loadJobs, 5000);
      setTimeout(loadJobs, 10000);
    } catch (e) {
      addToast('Scrape failed: ' + e.message, 'error');
    } finally {
      setScraping(false);
    }
  }

  // ── Search filter (client-side) ────────────────────────────────────────────
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(q) ||
      j.company?.toLowerCase().includes(q) ||
      j.location?.toLowerCase().includes(q)
    );
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
              <div className="header-subtitle">Automated Application Engine</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              id="scrape-btn"
              className="btn btn-ghost btn-sm"
              onClick={handleScrape}
              disabled={scraping}
            >
              {scraping ? <><span className="spinner" /> Scraping...</> : '🕷️ Scrape Jobs'}
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
              Scrape, fill, and screenshot job applications — hands free.
            </p>
            <StatsBar stats={stats} />
          </section>

          {/* Candidate Panel */}
          <CandidatePanel
            candidate={candidate}
            onResumeUploaded={(updated) => {
              if (updated) {
                setCandidate(updated);
                addToast(`Profile updated from resume: ${updated.firstName} ${updated.lastName}`, 'success');
              } else {
                fetchCandidate().then(setCandidate).catch(() => {});
              }
            }}
            onCandidateUpdated={(updated) => {
              setCandidate(updated);
              addToast('Candidate profile & EEO answers saved!', 'success');
            }}
          />

          {/* Controls Bar with Real Submission Mode Toggle */}
          <div className="controls-bar">
            <SearchBar value={search} onChange={setSearch} />

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

            <ApplyAllButton
              stats={stats}
              progress={progress}
              allowSubmit={allowSubmit}
              onStarted={() =>
                addToast(
                  allowSubmit
                    ? 'Apply-all started in REAL SUBMIT mode!'
                    : 'Apply-all started in Proof-only mode!',
                  'success'
                )
              }
            />
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

      {/* ── Toasts ────────────────────────────────────────────────────────────── */}
      <Toast toasts={toasts} />
    </>
  );
}
