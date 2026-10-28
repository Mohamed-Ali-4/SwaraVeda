import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import api, { errorMessage } from '../lib/api';
import { initials } from '../lib/format';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import { Alert, Button, Card, Field, PageHeader } from '../components/ui';
import { PasswordInput } from '../components/AuthShell';

const roleHelp: Record<string, string> = {
  contributor: 'You can record, upload and correct transcripts.',
  verifier: 'You can also approve corrections and export the dataset.',
  admin: 'You can also manage people and their roles.',
};

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [nativeDialect, setNativeDialect] = useState(user?.native_dialect || '');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/me', { display_name: displayName.trim(), native_dialect: nativeDialect.trim() || null });
      await refreshUser();
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed.');
    } catch (err) {
      setPwError(errorMessage(err, 'Could not change password'));
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Your account" title="Profile" />

      <Card className="flex items-center gap-4 p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lotus-100 font-display text-xl font-bold text-lotus-600">{initials(user.display_name)}</span>
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{user.display_name}</p>
          <p className="text-sm text-muted truncate">{user.email}</p>
          <p className="mt-1 text-sm"><span className="font-medium capitalize text-saffron-700">{user.role}</span> <span className="text-muted">· {roleHelp[user.role]}</span></p>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleProfile} className="space-y-5">
          <h2 className="text-lg font-semibold text-ink">About you</h2>
          <Field label="Name" htmlFor="p-name">
            <input id="p-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className={input} />
          </Field>
          <Field label="Mother tongue" htmlFor="p-dialect" hint="Helps verifiers know which recordings you can check.">
            <input id="p-dialect" value={nativeDialect} onChange={(e) => setNativeDialect(e.target.value)} className={input} />
          </Field>
          <Button type="submit" loading={saving}>Save</Button>
        </form>
      </Card>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handlePassword} className="space-y-5">
          <h2 className="text-lg font-semibold text-ink">Change password</h2>
          {pwError && <Alert>{pwError}</Alert>}
          <Field label="Current password" htmlFor="p-current">
            <PasswordInput id="p-current" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>
          <Field label="New password" htmlFor="p-new" hint="At least 8 characters.">
            <PasswordInput id="p-new" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </Field>
          <Button type="submit" variant="secondary" loading={pwSaving}>Change password</Button>
        </form>
      </Card>
    </div>
  );
}
