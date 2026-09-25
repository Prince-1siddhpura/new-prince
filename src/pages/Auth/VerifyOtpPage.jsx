import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, Mail, ArrowLeft, RefreshCw, CheckCircle2, 
  AlertCircle, Lock, Sparkles, KeyRound, Clock, Edit2, Check
} from 'lucide-react';
import { authApi } from '../../lib/apiClient';

export const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract email from query param or router state
  const queryParams = new URLSearchParams(location.search);
  const initialEmail = queryParams.get('email') || location.state?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  
  // 6 separate digits for OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // States
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.message || '');
  const [cooldown, setCooldown] = useState(60);
  const [isVerified, setIsVerified] = useState(false);

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle single digit input
  const handleChange = (index, value) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newOtp = [...otp];
    newOtp[index] = cleaned.slice(-1); // Take last char if multiple entered
    setOtp(newOtp);
    setError('');

    // Move to next input if digit entered
    if (cleaned && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle paste of full 6-digit code
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const digits = pastedData.slice(0, 6).split('');
    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      newOtp[i] = digit;
    });
    setOtp(newOtp);
    setError('');

    // Focus last filled digit or submit button
    const targetIndex = Math.min(digits.length, 5);
    if (inputRefs.current[targetIndex]) {
      inputRefs.current[targetIndex].focus();
    }
  };

  // Submit OTP Verification
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullCode = otp.join('');

    if (!email.trim()) {
      setError('Please provide a valid registered email address.');
      setIsEditingEmail(true);
      return;
    }

    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of your verification PIN.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authApi.confirmEmailVerification({
        email: email.trim().toLowerCase(),
        code: fullCode,
      });

      setIsVerified(true);
      setSuccess('🎉 Account verified and activated successfully! Redirecting...');

      // Update tokens if returned
      const token = response.data?.token || response.token;
      const refreshToken = response.data?.refreshToken || response.refreshToken;
      if (token) {
        localStorage.setItem('edunova_token', token);
      }
      if (refreshToken) {
        localStorage.setItem('edunova_refresh_token', refreshToken);
      }

      // Smooth redirect
      setTimeout(() => {
        const user = response.data?.user || response.user;
        if (user?.role === 'PARENT') {
          navigate('/parent/dashboard');
        } else if (user?.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/dashboard/school');
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Verification failed. The code may be incorrect or expired.');
      // Clear inputs for retry
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  // Request new OTP via SMTP
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    if (!email.trim()) {
      setError('Please enter your email to resend the code.');
      setIsEditingEmail(true);
      return;
    }

    setResending(true);
    setError('');
    setSuccess('');

    try {
      const res = await authApi.requestEmailVerification(email.trim().toLowerCase());
      setSuccess(res.data?.message || res.message || '✓ A fresh 6-digit OTP code has been sent to your email.');
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="edunova-auth-card"
      data-theme="dark"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '38px 34px',
        position: 'relative',
        borderRadius: '28px',
        background: 'linear-gradient(145deg, rgba(20, 28, 65, 0.88) 0%, rgba(10, 15, 38, 0.96) 60%, rgba(18, 12, 45, 0.90) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65), 0 0 40px rgba(56, 189, 248, 0.18), inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.35)',
        backdropFilter: 'blur(32px) saturate(190%)',
        color: '#ffffff'
      }}
    >
      {/* Back Link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <Link
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--accent-cyan, #38bdf8)',
            textDecoration: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            transition: 'opacity 0.2s'
          }}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: '#38bdf8',
            fontWeight: 700
          }}
        >
          <ShieldCheck size={13} /> 2FA Verification
        </span>
      </div>

      {/* Header Icon & Title */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.25))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 10px 25px rgba(56, 189, 248, 0.25)'
          }}
        >
          {isVerified ? (
            <CheckCircle2 size={32} color="#34d399" />
          ) : (
            <KeyRound size={32} color="#38bdf8" />
          )}
        </div>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>
          {isVerified ? 'Account Activated!' : 'Verify Your Email'}
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.65)', margin: 0, lineHeight: 1.5 }}>
          {isVerified
            ? 'Your email has been authenticated. Redirecting you to your portal...'
            : 'Enter the 6-digit confirmation code dispatched via SMTP to your mailbox.'}
        </p>

        {/* Email Capsule & Edit Toggle */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            padding: '6px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            fontSize: '0.85rem'
          }}
        >
          <Mail size={14} color="#38bdf8" />
          {isEditingEmail ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoFocus
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
                width: '180px'
              }}
            />
          ) : (
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{email || 'No email specified'}</span>
          )}
          <button
            type="button"
            onClick={() => setIsEditingEmail(!isEditingEmail)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isEditingEmail ? 'Save' : 'Change email'}
          >
            {isEditingEmail ? <Check size={14} color="#34d399" /> : <Edit2 size={13} />}
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '0.84rem',
            marginBottom: '20px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            color: '#6ee7b7',
            fontSize: '0.84rem',
            marginBottom: '20px'
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {/* 6-Digit OTP Form */}
      {!isVerified && (
        <form onSubmit={handleVerify}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '24px'
            }}
            onPaste={handlePaste}
          >
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                style={{
                  width: '52px',
                  height: '60px',
                  borderRadius: '14px',
                  border: error
                    ? '1.5px solid rgba(239, 68, 68, 0.6)'
                    : digit
                    ? '1.5px solid var(--accent-cyan, #38bdf8)'
                    : '1.5px solid rgba(255, 255, 255, 0.16)',
                  background: digit
                    ? 'rgba(56, 189, 248, 0.1)'
                    : 'rgba(15, 23, 42, 0.65)',
                  color: '#ffffff',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none',
                  boxShadow: digit
                    ? '0 0 15px rgba(56, 189, 248, 0.25)'
                    : 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: 'monospace'
                }}
              />
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '14px',
              border: 'none',
              background: otp.join('').length === 6 && !loading
                ? 'linear-gradient(135deg, #0284c7 0%, #6366f1 50%, #a855f7 100%)'
                : 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.96rem',
              fontWeight: 800,
              cursor: otp.join('').length === 6 && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: otp.join('').length === 6
                ? '0 10px 25px rgba(2, 132, 199, 0.4)'
                : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Verifying Code...
              </>
            ) : (
              <>
                <Lock size={18} /> Confirm & Activate Account
              </>
            )}
          </button>
        </form>
      )}

      {/* Resend Cooldown Section */}
      {!isVerified && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.6)', margin: '0 0 8px' }}>
            Didn't receive the verification code? Check your spam folder or
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            style={{
              background: 'transparent',
              border: 'none',
              color: cooldown > 0 ? 'rgba(255, 255, 255, 0.4)' : '#38bdf8',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: cooldown > 0 || resending ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {resending
              ? 'Dispatching via SMTP...'
              : cooldown > 0
              ? `Resend available in (${cooldown}s)`
              : 'Resend Verification Code'}
          </button>
        </div>
      )}

      {/* Security Footer Details */}
      <div
        style={{
          marginTop: '28px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.74rem',
          color: 'rgba(255, 255, 255, 0.45)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={12} /> Valid for 15 minutes
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldCheck size={12} /> Keyed HMAC Protection
        </span>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
