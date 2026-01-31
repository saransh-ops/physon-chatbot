import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

function Login({ onLogin }) {
  const [step, setStep] = useState(1); // 1: Login, 2: Verify OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requiresOTP) {
        setMessage(data.message);
        setStep(2); // Move to OTP verification
      } else {
        onLogin(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/verify-login-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }

      setMessage('New verification code sent!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🤖 AI Chatbot</h1>
          {step === 1 ? (
            <>
              <h2>Welcome Back!</h2>
              <p>Sign in to continue your conversations</p>
            </>
          ) : (
            <>
              <h2>Verify Your Identity</h2>
              <p>Enter the 6-digit code sent to {email}</p>
            </>
          )}
        </div>

        {step === 1 ? (
          <form onSubmit={handleLogin} className="auth-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength="6"
                className="otp-input"
                required
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <div className="resend-section">
              <p>Didn't receive the code?</p>
              <button 
                type="button" 
                onClick={handleResendOTP} 
                className="link-button"
                disabled={loading}
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;