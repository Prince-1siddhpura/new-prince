import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Home, LogOut } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';

export const getDefaultDashboardRoute = (role) => {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'INSTRUCTOR':
      return '/instructor/dashboard';
    case 'PARENT':
      return '/parent/dashboard';
    case 'STUDENT':
    default:
      return '/dashboard';
  }
};

export const UnauthorizedState = ({ allowedRoles = [], currentRole = 'GUEST', autoRedirect = true }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [countdown, setCountdown] = useState(autoRedirect ? 5 : null);
  const permittedDashboard = getDefaultDashboardRoute(currentRole);

  useEffect(() => {
    if (!autoRedirect || countdown === null) return;
    if (countdown <= 1) {
      navigate(permittedDashboard, { replace: true });
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, autoRedirect, navigate, permittedDashboard]);

  return (
    <div
      style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '540px',
          width: '100%',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '24px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 40px -15px rgba(239, 68, 68, 0.2), 0 0 50px -10px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow ambient background */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '180px',
            height: '180px',
            background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            marginBottom: '24px',
            color: '#ef4444',
          }}
        >
          <ShieldAlert size={42} />
        </div>

        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            color: '#f8fafc',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
        >
          Access Restricted
        </h2>

        <p
          style={{
            fontSize: '0.95rem',
            color: '#94a3b8',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          You do not have the required permissions to view this resource.
          {allowedRoles.length > 0 && (
            <span style={{ display: 'block', marginTop: '8px', color: '#cbd5e1' }}>
              Requires role:{' '}
              <strong style={{ color: '#f87171' }}>
                {allowedRoles.join(' or ')}
              </strong>
              {' '}| Your role:{' '}
              <strong style={{ color: '#38bdf8' }}>{currentRole}</strong>
            </span>
          )}
        </p>

        {autoRedirect && countdown !== null && (
          <div
            style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginBottom: '24px',
            }}
          >
            Redirecting to your permitted dashboard in{' '}
            <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{countdown}s</span>...
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <Button
            variant="primary"
            onClick={() => navigate(permittedDashboard, { replace: true })}
            style={{
              width: '100%',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              fontWeight: 600,
              padding: '12px 20px',
            }}
          >
            Go to My Dashboard <ArrowRight size={18} style={{ marginLeft: '8px' }} />
          </Button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              style={{
                flex: 1,
                justifyContent: 'center',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#cbd5e1',
              }}
            >
              <Home size={16} style={{ marginRight: '6px' }} /> Home
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              style={{
                flex: 1,
                justifyContent: 'center',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                color: '#f87171',
              }}
            >
              <LogOut size={16} style={{ marginRight: '6px' }} /> Switch Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedState;
