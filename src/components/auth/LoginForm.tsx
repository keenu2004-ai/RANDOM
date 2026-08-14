import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import { hrmsApi, setStoredToken } from '../../lib/api-client';

interface LoginFormProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@theiakshi.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot / Reset Password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetStep, setResetStep] = useState<'REQUEST' | 'RESET'>('REQUEST');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await hrmsApi.login(email, password);
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRole = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Password123!');
    setError(null);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess(null);
    setResetError(null);
    try {
      const res = await hrmsApi.forgotPassword(forgotEmail);
      setForgotSuccess(res.message);
      // In test/development environment, the API returns the raw reset token
      if (res._testOnlyToken) {
        setResetToken(res._testOnlyToken);
      }
      setResetStep('RESET');
    } catch (err: any) {
      setResetError(err.message);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess(null);
    setResetError(null);
    try {
      const res = await hrmsApi.resetPassword({ 
        email: forgotEmail, 
        newPassword,
        token: resetToken 
      });
      setForgotSuccess(res.message);
      setEmail(forgotEmail);
      setPassword(newPassword);
      setTimeout(() => {
        setShowForgot(false);
        setResetStep('REQUEST');
        setResetToken('');
      }, 2000);
    } catch (err: any) {
      setResetError(err.message);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-900/20 via-slate-900/10 to-transparent blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-600/30 tracking-wider">
            TE
          </div>
        </div>
        <h2 className="text-center text-2xl font-black tracking-tight text-white uppercase">
          THEIAKSHI ENTERPRISE
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400 font-medium">
          Enterprise Human Resource Management System (₹ INR)
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Work Email
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-login-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin@theiakshi.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  defaultChecked
                  className="h-3.5 w-3.5 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-400">
                  Remember session
                </label>
              </div>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Forgot password?
              </button>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick RBAC Role Test Selector */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Quick Test Credentials (RBAC)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickRole('admin@theiakshi.com')}
                className={`p-2 rounded border text-left font-medium transition-all ${
                  email === 'admin@theiakshi.com'
                    ? 'bg-purple-900/40 text-purple-300 border-purple-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">Super Admin</div>
                <div className="text-[10px] text-slate-500">Full Control</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRole('hr@theiakshi.com')}
                className={`p-2 rounded border text-left font-medium transition-all ${
                  email === 'hr@theiakshi.com'
                    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">HR Manager</div>
                <div className="text-[10px] text-slate-500">People & Payroll</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRole('manager@theiakshi.com')}
                className={`p-2 rounded border text-left font-medium transition-all ${
                  email === 'manager@theiakshi.com'
                    ? 'bg-blue-900/40 text-blue-300 border-blue-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">Manager</div>
                <div className="text-[10px] text-slate-500">Team Approvals</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRole('employee@theiakshi.com')}
                className={`p-2 rounded border text-left font-medium transition-all ${
                  email === 'employee@theiakshi.com'
                    ? 'bg-amber-900/40 text-amber-300 border-amber-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold">Employee</div>
                <div className="text-[10px] text-slate-500">Self-Service</div>
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 text-center">
              Password for all test roles: <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">Password123!</code>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <KeyRound className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">Reset Account Password</h3>
            </div>

            {forgotSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg">
                {forgotSuccess}
              </div>
            )}

            {resetError && (
              <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg">
                {resetError}
              </div>
            )}

            {resetStep === 'REQUEST' ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter your registered official email address to generate a password reset request.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="e.g., hr@theiakshi.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(false);
                      setResetError(null);
                      setForgotSuccess(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
                  >
                    Generate Reset Token
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Set a new secure password for <span className="font-bold text-white">{forgotEmail}</span>.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep('REQUEST')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all"
                  >
                    Set New Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
