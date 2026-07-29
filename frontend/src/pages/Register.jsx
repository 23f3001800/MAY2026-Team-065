// Register page — citizens only. The other three roles (municipal_officer,
// field_worker, admin) are created by an admin on the backend, never here.
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { FormField, TextInput, PasswordInput, Alert, SubmitButton } from '../components/formControls';
import { IconUser, IconMail, IconLock, IconPhone, IconMapPin } from '../components/icons';
import { registerCitizen } from '../api/auth';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const { fullName, email, phoneNumber, address, password, confirmPassword } = form;
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!email) return 'Please enter your email.';
    if (!phoneNumber.trim()) return 'Please enter your phone number.';
    if (!address.trim()) return 'Please enter your address.';
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setMessage({ text: error, type: 'error' });
      return;
    }
    setMessage({ text: '', type: '' });
    setLoading(true);
    try {
      await registerCitizen(form);
      setMessage({ text: 'Account created! Redirecting to login…', type: 'success' });
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="mb-6 text-left">
        <h2 className="font-display text-[28px] font-bold text-[#f8fafc] tracking-tight mb-1.5">
          Join SmartCivic
        </h2>
        <div className="text-sm text-[#94a3b8]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary font-semibold transition-fast hover:text-[#f8fafc] hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>

      <Alert message={message} />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="Full Name">
          <TextInput
            icon={<IconUser />}
            type="text"
            placeholder="John Doe"
            value={form.fullName}
            onChange={set('fullName')}
            autoComplete="name"
            required
          />
        </FormField>

        <FormField label="Email">
          <TextInput
            icon={<IconMail />}
            type="email"
            placeholder="name@civicconnect.org"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Phone Number">
          <TextInput
            icon={<IconPhone />}
            type="tel"
            placeholder="+91 90000 00000"
            value={form.phoneNumber}
            onChange={set('phoneNumber')}
            autoComplete="tel"
            required
          />
        </FormField>

        <FormField label="Address">
          <TextInput
            icon={<IconMapPin />}
            type="text"
            placeholder="House / Street, Area, City"
            value={form.address}
            onChange={set('address')}
            autoComplete="street-address"
            required
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <FormField label="Password">
            <PasswordInput
              icon={<IconLock />}
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              required
            />
          </FormField>

          <FormField label="Confirm Password">
            <PasswordInput
              icon={<IconLock />}
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              autoComplete="new-password"
              required
            />
          </FormField>
        </div>

        <SubmitButton loading={loading}>Register</SubmitButton>
      </form>
    </AuthCard>
  );
}
