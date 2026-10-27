import React from 'react';

const ErrorState = ({ title = 'Error', message = 'Something went wrong.', onRetry = null }) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    color: '#f8fafc',
    fontFamily: 'sans-serif',
    maxWidth: '500px',
    margin: '2rem auto'
  };

  const iconStyle = {
    fontSize: '3rem',
    color: '#ef4444',
    marginBottom: '1rem'
  };

  const buttonStyle = {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  };

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>⚠️</div>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#ef4444' }}>{title}</h3>
      <p style={{ margin: 0, color: '#94a3b8' }}>{message}</p>
      {onRetry && (
        <button style={buttonStyle} onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
