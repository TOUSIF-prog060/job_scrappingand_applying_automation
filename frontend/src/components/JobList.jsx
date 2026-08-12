import JobCard from './JobCard';

export default function JobList({ jobs, allowSubmit = false, onApplyStart, onScreenshot }) {
  if (jobs.length === 0) {
    return (
      <div className="job-grid">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search or click "Scrape Jobs" to fetch new listings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-grid">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          allowSubmit={allowSubmit}
          onApplyStart={onApplyStart}
          onScreenshot={onScreenshot}
        />
      ))}
    </div>
  );
}
