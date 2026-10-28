import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import api, { errorMessage } from '../lib/api';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [nativeDialect, setNativeDialect] = useState(user?.native_dialect || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/me', { display_name: displayName, native_dialect: nativeDialect || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    try {
      await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      setPwError(errorMessage(err, 'Failed to change password'));
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Profile</h1>

      <form onSubmit={handleProfile} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="font-semibold text-stone-700">Account Details</h2>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
          <input value={user?.email || ''} disabled className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Native Dialect</label>
          <input
            value={nativeDialect}
            onChange={(e) => setNativeDialect(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm cursor-pointer">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </form>

      <form onSubmit={handlePassword} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="font-semibold text-stone-700">Change Password</h2>
        {pwError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{pwError}</div>}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="px-6 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 text-sm cursor-pointer">
            Change Password
          </button>
          {pwSaved && <span className="text-sm text-green-600">Password changed!</span>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <p className="text-sm text-stone-500">
          Role: <span className="font-medium text-stone-700 capitalize">{user?.role}</span>
        </p>
      </div>
    </div>
  );
}
