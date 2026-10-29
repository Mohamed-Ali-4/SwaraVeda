import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Profile from './pages/Profile';
import Manage from './pages/Manage';
import Review from './pages/Review';

/** The cover (sign-in) page is the front door: signed-out visitors see it at
 * every address, and the page they asked for opens once they sign in. */
function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07060d]">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet-400 border-t-transparent" />
      </div>
    );
  }
  return user ? <Layout /> : <Cover />;
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
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route element={<Gate />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/recordings/new" element={<NewRecording />} />
              <Route path="/recordings/:id" element={<RecordingDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/dialects" element={<Dialects />} />
              <Route path="/review" element={<Review />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/manage" element={<ProtectedRoute><Manage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
