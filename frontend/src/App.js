import React, { useState, useEffect } from 'react';

// --- INLINE SVG ICONS FOR FAST LOAD & ZERO DEPENDENCY ---
const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);

const IconPhone = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
);

const IconShieldCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 11 11 13 15 9"></polyline></svg>
);

const IconChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

const IconInfo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('citizen');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const clearForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPhoneNumber('');
    setMessage({ text: '', type: '' });
  };

  const handleToggleMode = () => {
    const nextIsRegister = !isRegister;
    setIsRegister(nextIsRegister);
    if (nextIsRegister) setRole('citizen');
    clearForm();
  };

  const validateForm = () => {
    if (!email || !password) {
      setMessage({ text: 'Please fill in all credentials.', type: 'error' });
      return false;
    }
    if (isRegister) {
      if (!fullName) {
        setMessage({ text: 'Please enter your full name.', type: 'error' });
        return false;
      }
      if (password.length < 6) {
        setMessage({ text: 'Password must be at least 6 characters long.', type: 'error' });
        return false;
      }
      if (password !== confirmPassword) {
        setMessage({ text: 'Passwords do not match.', type: 'error' });
        return false;
      }
      if (!phoneNumber.trim()) {
        setMessage({ text: 'Please enter your phone number.', type: 'error' });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      if (isRegister) {
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
            phone_number: phoneNumber.trim(),
            ward_number: null,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Registration failed');
        setMessage({ text: 'Account registered successfully! Please login.', type: 'success' });
        setTimeout(() => {
          setIsRegister(false);
          setPassword('');
          setConfirmPassword('');
        }, 1500);
      } else {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Login failed. Please verify credentials.');
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setMessage({ text: 'Logged in successfully! Welcome back.', type: 'success' });
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    clearForm();
  };

  return (
    <div className="min-h-screen">
      {/* ── Background Animated Blobs ── */}
      <div className="bg-blob-container">
        {/* Blob 1 – Emerald, top-right */}
        <div className="bg-blob w-[500px] h-[500px] bg-primary -top-[100px] -right-[50px] animate-float-blob-1" />
        {/* Blob 2 – Blue, bottom-left */}
        <div className="bg-blob w-[600px] h-[600px] bg-secondary -bottom-[200px] -left-[100px] animate-float-blob-2" />
        {/* Blob 3 – Purple, center */}
        <div className="bg-blob w-[400px] h-[400px] bg-[#a855f7] top-[40%] left-[30%] !opacity-[0.08] animate-float-blob-3" />
      </div>

      {/* ── Main Auth Container ── */}
      <div className="flex items-center justify-center min-h-screen px-6 py-6 relative z-10">
        {currentUser ? (
          /* ── Logged-In Dashboard View ── */
          <div className="w-full max-w-[550px] bg-[rgba(15,23,42,0.3)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.07)] rounded-3xl p-8 shadow-card animate-card-appear-fast text-center">
            {/* Success Badge */}
            <div className="w-16 h-16 rounded-full bg-[rgba(16,185,129,0.1)] border-2 border-primary flex items-center justify-center mx-auto mb-5 text-primary shadow-badge animate-badge-pulse">
              <IconShieldCheck />
            </div>

            <h1 className="font-display text-[28px] font-bold text-[#f8fafc] tracking-tight mb-2 text-center">
              Access Granted
            </h1>
            <p className="text-sm text-[#94a3b8] text-center mb-6">
              Securely connected to <strong className="text-[#f8fafc]">SmartCivicConnect</strong>
            </p>

            {/* Profile Card */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 my-6 text-left">
              <ProfileRow label="Identity Name" value={currentUser.full_name} />
              <ProfileRow label="Email Signature" value={currentUser.email} />
              <div className="flex justify-between py-3 border-b border-[rgba(255,255,255,0.05)]">
                <span className="text-[#94a3b8] text-[13px]">System Role</span>
                <RolePill role={currentUser.role} />
              </div>
              {currentUser.phone_number && (
                <ProfileRow label="Registered Phone" value={currentUser.phone_number} />
              )}
              {currentUser.ward_number && (
                <ProfileRow label="Resident Ward" value={`Ward #${currentUser.ward_number}`} />
              )}
              <ProfileRow label="Member Since" value={new Date(currentUser.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} isLast />
            </div>

            <button
              onClick={handleLogout}
              className="bg-transparent border border-[rgba(255,255,255,0.07)] rounded-xl px-6 py-3 text-[#94a3b8] font-primary font-semibold text-sm cursor-pointer transition-smooth hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444] hover:border-[rgba(239,68,68,0.2)]"
            >
              Terminate Session
            </button>
          </div>
        ) : (
          /* ── Auth Card ── */
          <div className="w-[1000px] max-w-full min-h-[620px] bg-[rgba(15,23,42,0.3)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.07)] rounded-3xl flex overflow-hidden shadow-card animate-card-appear max-[820px]:min-h-0 max-[820px]:w-[480px]">

            {/* ── Left: Illustration Pane ── */}
            <div className="flex-1 illustration-gradient border-r border-[rgba(255,255,255,0.07)] p-12 flex flex-col justify-between relative overflow-hidden max-[820px]:hidden">
              {/* Branding */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 logo-gradient rounded-xl flex items-center justify-center text-white font-extrabold text-xl font-display shadow-logo">
                  C
                </div>
                <div className="font-display font-bold text-xl tracking-[-0.5px] gradient-text-title">
                  SmartCivicConnect
                </div>
              </div>

              {/* Civic Feed Mock */}
              <div className="my-10 relative">
                <div className="bg-[rgba(9,13,22,0.6)] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 relative z-10 shadow-feed">
                  {/* Feed Header */}
                  <div className="flex justify-between items-center mb-4 border-b border-[rgba(255,255,255,0.05)] pb-[10px]">
                    <span className="flex items-center text-[12px] font-semibold">
                      <span className="w-2 h-2 bg-primary rounded-full inline-block mr-2 shadow-[0_0_10px_#10b981] animate-pulse-dot" />
                      Ward Resolution Live Feed
                    </span>
                    <span className="text-[10px] text-[#64748b]">Updated just now</span>
                  </div>

                  {/* Feed Item 1 */}
                  <div className="flex gap-3 bg-[rgba(255,255,255,0.03)] p-3 rounded-[10px] text-[13px] mb-2 items-center border-l-[3px] border-primary text-left">
                    <div className="flex-1">
                      <div className="font-semibold text-[#f8fafc]">Waterline Leakage Resolved</div>
                      <div className="text-[11px] text-[#94a3b8]">Sector 4 - Ward #22</div>
                    </div>
                  </div>

                  {/* Feed Item 2 */}
                  <div className="flex gap-3 bg-[rgba(255,255,255,0.03)] p-3 rounded-[10px] text-[13px] mb-2 items-center border-l-[3px] border-secondary text-left">
                    <div className="flex-1">
                      <div className="font-semibold text-[#f8fafc]">Streetlight Outage Logged</div>
                      <div className="flex justify-between text-[11px] text-[#94a3b8]">
                        <span>Park Lane - Ward #12</span>
                        <span className="text-secondary font-semibold">Pending</span>
                      </div>
                    </div>
                  </div>

                  {/* Feed Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 text-center transition-smooth hover:bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5">
                      <div className="font-display text-xl font-bold text-primary">1,492</div>
                      <div className="text-[11px] text-[#94a3b8] mt-1 uppercase tracking-[0.5px]">Resolved</div>
                    </div>
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 text-center transition-smooth hover:bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5">
                      <div className="font-display text-xl font-bold text-secondary">86%</div>
                      <div className="text-[11px] text-[#94a3b8] mt-1 uppercase tracking-[0.5px]">SLA Efficiency</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quote */}
              <div className="text-sm text-[#94a3b8] leading-relaxed">
                <p>
                  "A cleaner, safer, and smarter municipality begins with{' '}
                  <span className="text-primary font-semibold">civic mindfulness</span>
                  {' '}and prompt civic reporting."
                </p>
              </div>
            </div>

            {/* ── Right: Form Pane ── */}
            <div className="flex-[1.2] p-12 flex flex-col justify-center relative bg-[rgba(15,23,42,0.15)] max-[480px]:p-6">
              {/* Form Header */}
              <div className="mb-6 text-left">
                <h2 className="font-display text-[28px] font-bold text-[#f8fafc] tracking-tight mb-1.5">
                  {isRegister ? 'Join SmartCivic' : 'Authentication'}
                </h2>
                <div className="text-sm text-[#94a3b8]">
                  {isRegister ? (
                    <>
                      Already have an account?{' '}
                      <span
                        className="text-primary font-semibold cursor-pointer transition-fast hover:text-[#f8fafc] hover:underline"
                        onClick={handleToggleMode}
                      >
                        Sign In
                      </span>
                    </>
                  ) : (
                    <>
                      New to the portal?{' '}
                      <span
                        className="text-primary font-semibold cursor-pointer transition-fast hover:text-[#f8fafc] hover:underline"
                        onClick={handleToggleMode}
                      >
                        Register here
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Alert Banner */}
              {message.text && (
                <div
                  className={`flex items-center gap-3 px-4 py-[14px] rounded-xl mb-5 text-[13px] animate-slide-in-alert border ${message.type === 'error'
                    ? 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#fca5a5]'
                    : 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)] text-[#a7f3d0]'
                    }`}
                >
                  <div className="flex-shrink-0 flex items-center"><IconInfo /></div>
                  <div>{message.text}</div>
                </div>
              )}

              {/* Role Tabs */}
              {isRegister ? (
                <div className="mb-6">
                  <div className="flex bg-[rgba(15,23,42,0.4)] p-1 rounded-xl border border-[rgba(255,255,255,0.07)] mb-[10px]">
                    <RoleTabButton active>
                      <IconUser /> Citizen
                    </RoleTabButton>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 bg-[rgba(15,23,42,0.4)] p-1 rounded-xl border border-[rgba(255,255,255,0.07)] mb-6">
                  <RoleTabButton active={role === 'citizen'} onClick={() => setRole('citizen')}>
                    <IconUser /> Citizen
                  </RoleTabButton>
                  <RoleTabButton active={role === 'officer'} onClick={() => setRole('officer')}>
                    <IconShieldCheck /> Officer
                  </RoleTabButton>
                  <RoleTabButton active={role === 'admin'} onClick={() => setRole('admin')}>
                    <IconLock /> Admin
                  </RoleTabButton>
                </div>
              )}

              {/* Form */}
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {isRegister && (
                  <FormField label="Full Name">
                    <InputWrapper icon={<IconUser />}>
                      <input
                        type="text"
                        className="auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 pl-[42px] pr-[14px] text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </InputWrapper>
                  </FormField>
                )}

                <FormField label="Email Signature">
                  <InputWrapper icon={<IconMail />}>
                    <input
                      type="email"
                      className="auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 pl-[42px] pr-[14px] text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus"
                      placeholder="name@civicconnect.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </InputWrapper>
                </FormField>

                {isRegister && (
                  <FormField label="Phone Number">
                    <InputWrapper icon={<IconPhone />}>
                      <input
                        type="tel"
                        className="auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 pl-[42px] pr-[14px] text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus"
                        placeholder="+1 555-0199"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                      />
                    </InputWrapper>
                  </FormField>
                )}

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: isRegister ? '1fr 1fr' : '1fr' }}
                >
                  <FormField label="Secure Password">
                    <InputWrapper icon={<IconLock />}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 pl-[42px] pr-[42px] text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-[14px] bg-none border-none text-[#64748b] cursor-pointer flex items-center p-0 transition-fast hover:text-[#f8fafc]"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </InputWrapper>
                  </FormField>

                  {isRegister && (
                    <FormField label="Confirm Password">
                      <InputWrapper icon={<IconLock />}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 pl-[42px] pr-[42px] text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </InputWrapper>
                    </FormField>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="submit-btn-shimmer submit-gradient border-none rounded-xl py-[14px] text-white font-display text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 shadow-btn transition-smooth mt-[10px] relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 hover:enabled:shadow-btn-hover active:enabled:translate-y-0"
                >
                  {isLoading ? (
                    <div className="w-[18px] h-[18px] border-2 border-[rgba(255,255,255,0.3)] rounded-full border-t-white animate-spin-slow" />
                  ) : (
                    <>
                      {isRegister ? 'Register' : 'Login'}
                      <IconChevronRight />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Small reusable sub-components ── */

function ProfileRow({ label, value, isLast = false }) {
  return (
    <div className={`flex justify-between py-3 ${isLast ? '' : 'border-b border-[rgba(255,255,255,0.05)]'}`}>
      <span className="text-[#94a3b8] text-[13px]">{label}</span>
      <span className="text-[#f8fafc] font-semibold text-[13px]">{value}</span>
    </div>
  );
}

function RolePill({ role }) {
  const styles = {
    citizen: 'bg-[rgba(16,185,129,0.15)] text-primary border-[rgba(16,185,129,0.25)]',
    officer: 'bg-[rgba(59,130,246,0.15)] text-secondary border-[rgba(59,130,246,0.25)]',
    admin: 'bg-[rgba(168,85,247,0.15)] text-[#c084fc] border-[rgba(168,85,247,0.25)]',
  };
  return (
    <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold uppercase tracking-[0.5px] border ${styles[role] || styles.citizen}`}>
      {role}
    </span>
  );
}

function RoleTabButton({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 text-[12px] font-semibold px-1 py-[10px] rounded-lg cursor-pointer transition-smooth font-primary border
        ${active
          ? 'role-tab-active-bg text-[#f8fafc] shadow-[inset_0_0_10px_rgba(255,255,255,0.02)] border-[rgba(16,185,129,0.2)]'
          : 'bg-transparent text-[#94a3b8] border-transparent hover:text-[#f8fafc] hover:bg-[rgba(255,255,255,0.02)]'
        }`}
    >
      {children}
    </button>
  );
}

function FormField({ label, children }) {
  return (
    <div className="relative flex flex-col">
      <label className="text-[12px] font-semibold text-[#94a3b8] mb-1.5 text-left">{label}</label>
      {children}
    </div>
  );
}

function InputWrapper({ icon, children }) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-[14px] text-[#64748b] flex items-center pointer-events-none transition-fast z-10">
        {icon}
      </span>
      {children}
    </div>
  );
}

export default App;
