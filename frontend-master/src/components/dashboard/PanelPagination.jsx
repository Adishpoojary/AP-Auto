import React from 'react';

const buttonStyle = (disabled) => ({
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  background: disabled ? '#f9fafb' : '#ffffff',
  color: disabled ? '#9ca3af' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.75rem',
  fontWeight: 600,
});

const PanelPagination = ({ page, totalPages, limit, totalCount, onPageChange }) => {
  if (!totalCount || totalCount <= limit || totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalCount);
  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= totalPages;

  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: '100%',
      }}
    >
      <div style={{ fontSize: '0.73rem', color: '#9ca3af', textAlign: 'center' }}>
        Showing {start}-{end} of {totalCount}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" style={buttonStyle(isPrevDisabled)} onClick={() => onPageChange(page - 1)} disabled={isPrevDisabled}>
          Previous
        </button>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>Page {page} of {totalPages}</span>
        <button type="button" style={buttonStyle(isNextDisabled)} onClick={() => onPageChange(page + 1)} disabled={isNextDisabled}>
          Next
        </button>
      </div>
    </div>
  );
};

export default PanelPagination;
