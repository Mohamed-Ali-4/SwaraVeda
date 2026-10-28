import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import { AuthShell, PasswordInput } from '../components/AuthShell';
import { Alert, Button, Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = (location.state as { from?: string } | null)?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Signed in. Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={from !== '/' ? 'Sign in to continue where you left off.' : 'Sign in to record, correct and verify.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="login-email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className={input}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Your password"
          />
        </Field>
        <Button type="submit" loading={loading} size="lg" className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted">
        New to SwaraVeda?{' '}
        <Link to="/register" state={location.state} className="font-medium text-saffron-600 hover:text-saffron-700">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
