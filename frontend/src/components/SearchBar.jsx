export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-wrap">
      <span className="search-icon">🔍</span>
      <input
        id="job-search"
        type="text"
        className="search-input"
        placeholder="Search by title or company..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
