import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HiOutlineMap } from 'react-icons/hi';
import { AuthProvider, ProtectedRoute, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Layout from './components/Layout';
import { ButtonLink, EmptyState } from './components/ui';
import Dashboard from './pages/Dashboard';
import Cover from './pages/Cover';
import Recordings from './pages/Recordings';
import NewRecording from './pages/NewRecording';
import RecordingDetail from './pages/RecordingDetail';
import Search from './pages/Search';
import Dialects from './pages/Dialects';
import DialectShelf from './pages/DialectShelf';
import Profile from './pages/Profile';
import Manage from './pages/Manage';
import Review from './pages/Review';

// The preview build runs inside a sandboxed frame with no address bar of its own.
const PREVIEW = import.meta.env.VITE_PREVIEW === '1';
const Router = PREVIEW ? MemoryRouter : BrowserRouter;

/** The cover (sign-in) page is the front door: signed-out visitors see it at
 * every address, and the page they asked for opens once they sign in. */
function Gate({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D]">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#FFB224] border-t-transparent" />
      </div>
    );
  }
  return user ? children ?? <Layout /> : <Cover />;
}

/** Shown on the sign-in page of the preview build, where any details sign you in. */
function PreviewNote() {
  const { user } = useAuth();
  if (user) return null;
  return (
    <p className="pointer-events-none fixed bottom-3 left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
      Preview with sample data · any email and password signs you in
    </p>
  );
}

function NotFound() {
  return (
    <EmptyState icon={<HiOutlineMap className="w-7 h-7" />} title="This page doesn’t exist" action={<ButtonLink to="/">Go home</ButtonLink>}>
      The link may be old or mistyped.
    </EmptyState>
  );
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/dialects" element={<Gate><DialectShelf /></Gate>} />
            <Route path="/dialects/shelf" element={<Navigate to="/dialects" replace />} />
            <Route element={<Gate />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/recordings/new" element={<NewRecording />} />
              <Route path="/recordings/:id" element={<RecordingDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/dialects/list" element={<Dialects />} />
              <Route path="/review" element={<Review />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/manage" element={<ProtectedRoute><Manage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          {PREVIEW && <PreviewNote />}
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
