import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginModal = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin_user');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const modalRef = useRef(null);

  // Focus trap & Escape key listener (WCAG AA Accessibility Requirement)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Login failed');
      }

      const data = await res.json();
      // Store token in React memory ONLY
      login(data.access_token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (uname, pwd) => {
    setUsername(uname);
    setPassword(pwd);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
      <div ref={modalRef} className="modal-container bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="modal-header flex items-center justify-between pb-3 border-b border-gray-800">
          <h2 id="loginModalTitle" className="modal-title text-lg font-bold text-amber-400">
            LAABH System Login
          </h2>
          <button
            onClick={onClose}
            className="modal-close text-gray-400 hover:text-white text-lg px-2"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 text-red-200 text-xs rounded" role="alert">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div className="demo-accounts pt-2 border-t border-gray-800">
            <span className="text-[11px] text-gray-400 block mb-2 font-medium">Quick Role Login:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin_user', 'admin123')}
                className="px-2 py-1.5 bg-amber-950/40 border border-amber-700/40 text-amber-300 rounded hover:bg-amber-900/60 focus:ring-2 focus:ring-amber-500"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('civil_aviation_officer', 'officer123')}
                className="px-2 py-1.5 bg-blue-950/40 border border-blue-700/40 text-blue-300 rounded hover:bg-blue-900/60 focus:ring-2 focus:ring-blue-500"
              >
                Ministry Officer
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('aai_pm', 'pm123')}
                className="px-2 py-1.5 bg-purple-950/40 border border-purple-700/40 text-purple-300 rounded hover:bg-purple-900/60 focus:ring-2 focus:ring-purple-500"
              >
                Agency PM
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('analyst_user', 'analyst123')}
                className="px-2 py-1.5 bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 rounded hover:bg-emerald-900/60 focus:ring-2 focus:ring-emerald-500"
              >
                Analyst
              </button>
            </div>
          </div>

          <div className="modal-footer flex justify-end gap-3 pt-3 border-t border-gray-800">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              {loading ? 'Authenticating...' : 'Login with JWT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
