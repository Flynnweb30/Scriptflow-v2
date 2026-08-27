import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error handling for React 19
const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Failed to find the root element');
}

// Create root and render
const root = ReactDOM.createRoot(rootElement);

// Render with error boundary
try {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} catch (error) {
    console.error('Failed to render app:', error);
    // Show fallback UI
    rootElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#030712;color:#f1f5f9;flex-direction:column;gap:16px;font-family:sans-serif;">
            <div style="font-size:48px;">⚠️</div>
            <h2 style="margin:0;color:#ef4444;">Something went wrong</h2>
            <p style="color:#94a3b8;margin:0;">Please refresh the page to try again.</p>
            <button onclick="window.location.reload()" style="padding:10px 24px;border:none;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;font-size:14px;">
                Refresh Page
            </button>
        </div>
    `;
}