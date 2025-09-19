import { Routes, Route } from 'react-router-dom';
import './styles.css';

// Page components
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MemoryProfile from './pages/MemoryProfile';
import GenerateResume from './pages/GenerateResume';
import History from './pages/History';
import Extension from './pages/Extension';

// Layout components
import ProtectedRoute from './layouts/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <MemoryProfile />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/generate" element={
        <ProtectedRoute>
          <DashboardLayout>
            <GenerateResume />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <DashboardLayout>
            <History />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/extension" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Extension />
          </DashboardLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}