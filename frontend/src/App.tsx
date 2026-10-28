import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HiOutlineMap } from 'react-icons/hi';
import { AuthProvider, ProtectedRoute } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Layout from './components/Layout';
import { ButtonLink, EmptyState } from './components/ui';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Recordings from './pages/Recordings';
import NewRecording from './pages/NewRecording';
import RecordingDetail from './pages/RecordingDetail';
import Search from './pages/Search';
import Dialects from './pages/Dialects';
import Profile from './pages/Profile';
import Manage from './pages/Manage';
import Review from './pages/Review';

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
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/recordings/new" element={<ProtectedRoute><NewRecording /></ProtectedRoute>} />
              <Route path="/recordings/:id" element={<RecordingDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/dialects" element={<Dialects />} />
              <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/manage" element={<ProtectedRoute><Manage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
