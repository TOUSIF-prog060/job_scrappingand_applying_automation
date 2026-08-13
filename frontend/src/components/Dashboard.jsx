import { useState, useEffect, useCallback } from 'react';
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

      {/* ── Toasts ────────────────────────────────────────────────────────────── */}
      <Toast toasts={toasts} />
    </>
  );
}
