import React from 'react';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    label?: string;
    fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'medium',
    color = '#3b82f6',
    label,
    fullScreen = false
}) => {
    const sizeMap = {
        small: 24,
        medium: 40,
        large: 56
    };

    const spinnerSize = sizeMap[size];

    const spinner = (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
        }}>
            <div style={{
                width: spinnerSize,
                height: spinnerSize,
                border: `3px solid ${color}33`,
                borderTop: `3px solid ${color}`,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            {label && (
                <span style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    fontWeight: 500
                }}>
                    {label}
                </span>
            )}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );

    if (fullScreen) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#030712'
            }}>
                {spinner}
            </div>
        );
    }

    return spinner;
};

export default LoadingSpinner;