import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HiCheck } from 'react-icons/hi';
import { useAuth } from '../lib/auth';
import api, { errorMessage } from '../lib/api';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import type { Dialect } from '../lib/types';
import { AuthShell, PasswordInput } from '../components/AuthShell';
import { Alert, Button, Field } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = (location.state as { from?: string } | null)?.from || '/';
  const [form, setForm] = useState({ display_name: '', email: '', password: '', native_dialect: '' });
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const longEnough = form.password.length >= 8;

  useEffect(() => {
    api.get('/dialects').then((res) => setDialects(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!longEnough) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        password: form.password,
        native_dialect: form.native_dialect.trim() || undefined,
      });
      toast.success(`Welcome to SwaraVeda, ${form.display_name.trim().split(' ')[0]}!`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Join the archive" subtitle="Free for everyone who wants to keep a language alive.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field label="Your name" htmlFor="reg-name" hint="Shown next to the recordings and corrections you contribute.">
          <input
            id="reg-name"
            autoComplete="name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            required
            autoFocus
            maxLength={80}
            className={input}
            placeholder="e.g. Kamala Shetty"
          />
        </Field>
        <Field label="Email" htmlFor="reg-email">
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className={input}
            placeholder="you@example.com"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="reg-password"
          hint={
            <span className={`inline-flex items-center gap-1 ${longEnough ? 'text-leaf-600' : ''}`}>
              {longEnough && <HiCheck className="w-4 h-4" />} At least 8 characters
            </span>
          }
        >
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            placeholder="Choose a password"
          />
        </Field>
        <Field label="Your mother tongue (optional)" htmlFor="reg-dialect" hint="Helps verifiers know which recordings you can check.">
          <input
            id="reg-dialect"
            list="dialect-options"
            value={form.native_dialect}
            onChange={(e) => setForm({ ...form, native_dialect: e.target.value })}
            className={input}
            placeholder="e.g. Tulu"
          />
          <datalist id="dialect-options">
            {dialects.map((d) => <option key={d.id} value={d.name} />)}
          </datalist>
        </Field>
        <Button type="submit" loading={loading} size="lg" className="w-full">
          {loading ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-medium text-saffron-600 hover:text-saffron-700">Sign in</Link>
      </p>
    </AuthShell>
  );
}
