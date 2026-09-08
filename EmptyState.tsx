import React from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
    variant?: 'default' | 'auth' | 'empty' | 'error';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon = '📋',
    actionLabel,
    onAction,
    variant = 'default'
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'auth':
                return {
                    borderColor: 'rgba(59,130,246,0.2)',
                    bgGradient: 'rgba(59,130,246,0.04)',
                    iconBg: 'rgba(59,130,246,0.1)'
                };
            case 'error':
                return {
                    borderColor: 'rgba(239,68,68,0.2)',
                    bgGradient: 'rgba(239,68,68,0.04)',
                    iconBg: 'rgba(239,68,68,0.1)'
                };
            case 'empty':
                return {
                    borderColor: 'rgba(255,255,255,0.06)',
                    bgGradient: 'rgba(255,255,255,0.02)',
                    iconBg: 'rgba(255,255,255,0.04)'
                };
            default:
                return {
                    borderColor: 'rgba(255,255,255,0.06)',
                    bgGradient: 'rgba(255,255,255,0.02)',
                    iconBg: 'rgba(255,255,255,0.04)'
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            background: styles.bgGradient,
            borderRadius: '16px',
            border: `1px solid ${styles.borderColor}`,
            minHeight: '300px',
            width: '100%'
        }}>
            <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: styles.iconBg
            }}>
                {icon}
            </div>
            <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#f8fafc'
            }}>
                {title}
            </h3>
            <p style={{
                margin: '8px 0 16px',
                fontSize: '14px',
                color: '#94a3b8',
                maxWidth: '400px',
                lineHeight: '1.6'
            }}>
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    style={{
                        padding: '10px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#2563eb',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                    className="hover:opacity-90 hover:scale-[1.02]"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;