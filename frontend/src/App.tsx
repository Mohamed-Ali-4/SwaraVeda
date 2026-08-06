import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './lib/auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Recordings from './pages/Recordings';
import NewRecording from './pages/NewRecording';
import RecordingDetail from './pages/RecordingDetail';
import Search from './pages/Search';
import Dialects from './pages/Dialects';
import Profile from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
