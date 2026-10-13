//src/shared/ui/BackButton.tsx

// Arrow button pinned to the left of a modal header
export default function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="icon-btn"
      onClick={onClick}
      style={{
        position: 'absolute',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 26,
        height: 26,
        color: 'var(--text-secondary)',
      }}
      title="Back"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    </button>
  );
}
