import { useState } from 'react';

const PRESET_COMPANIES = [
  { id: 'figma', name: 'Figma', category: 'Design & Tools' },
  { id: 'stripe', name: 'Stripe', category: 'Fintech' },
  { id: 'discord', name: 'Discord', category: 'Communication' },
  { id: 'vercel', name: 'Vercel', category: 'Cloud Infrastructure' },
  { id: 'retool', name: 'Retool', category: 'Developer Tools' },
  { id: 'databricks', name: 'Databricks', category: 'AI & Data' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'Security & Cloud' },
  { id: 'openai', name: 'OpenAI', category: 'Artificial Intelligence' },
];

export default function CompanySelector({ onScrape, scraping }) {
  const [selectedBoards, setSelectedBoards] = useState(
    PRESET_COMPANIES.map((c) => c.id)
  );
  const [customBoard, setCustomBoard] = useState('');
  const [customList, setCustomList] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  function toggleBoard(boardId) {
    setSelectedBoards((prev) =>
      prev.includes(boardId) ? prev.filter((b) => b !== boardId) : [...prev, boardId]
    );
  }

  function handleAddCustom() {
    const clean = customBoard.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!clean) return;
    if (!selectedBoards.includes(clean)) {
      setSelectedBoards((prev) => [...prev, clean]);
    }
    if (!customList.includes(clean) && !PRESET_COMPANIES.some((p) => p.id === clean)) {
      setCustomList((prev) => [...prev, clean]);
    }
    setCustomBoard('');
  }

  function handleSelectAll() {
    const all = Array.from(new Set([...PRESET_COMPANIES.map((c) => c.id), ...customList]));
    setSelectedBoards(all);
  }

  function handleClearAll() {
    setSelectedBoards([]);
  }

  function handleTriggerScrape() {
    if (selectedBoards.length === 0) return;
    onScrape?.(selectedBoards);
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🏢</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Greenhouse Multi-Company Scraper
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {selectedBoards.length} company board{selectedBoards.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? '🔼 Hide Options' : '⚙️ Manage Companies'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleTriggerScrape}
            disabled={scraping || selectedBoards.length === 0}
          >
            {scraping ? (
              <>
                <span className="spinner" />
                Scraping {selectedBoards.length} Boards...
              </>
            ) : (
              `🕷️ Scrape ${selectedBoards.length} Company Board${selectedBoards.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>

      {/* Preset Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
        {PRESET_COMPANIES.map((comp) => {
          const isSelected = selectedBoards.includes(comp.id);
          return (
            <button
              key={comp.id}
              type="button"
              onClick={() => toggleBoard(comp.id)}
              style={{
                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-glass)',
                border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                color: isSelected ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelected ? '✓ ' : '+ '}
              {comp.name}
            </button>
          );
        })}

        {customList.map((cBoard) => {
          const isSelected = selectedBoards.includes(cBoard);
          return (
            <button
              key={cBoard}
              type="button"
              onClick={() => toggleBoard(cBoard)}
              style={{
                background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-glass)',
                border: isSelected ? '1px solid var(--accent-green)' : '1px solid var(--glass-border)',
                color: isSelected ? 'var(--accent-green)' : 'var(--text-secondary)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {isSelected ? '✓ ' : '+ '}
              {cBoard}
            </button>
          );
        })}
      </div>

      {/* Extended Panel */}
      {isOpen && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }} onClick={handleSelectAll}>
              Select All
            </button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }} onClick={handleClearAll}>
              Clear All
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="Add Greenhouse token (e.g. doordash, airbnb)"
              value={customBoard}
              onChange={(e) => setCustomBoard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              style={{
                flex: 1,
                background: 'var(--bg-glass)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddCustom}>
              + Add Board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
