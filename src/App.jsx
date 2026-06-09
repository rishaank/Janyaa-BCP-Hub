import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import ProfilePage from './pages/ProfilePage'
import EventsMeetings from './pages/EventsMeetings'
import Fundraising from './pages/Fundraising'
import Goals from './pages/Goals'
import AutoHours from './pages/AutoHours'
import Locations from './pages/Locations'
import Restaurants from './pages/Restaurants'
import AIPlanning from './pages/AIPlanning'
import History from './pages/History'
import HoursRequests from './pages/HoursRequests'
import ClubInfo from './pages/ClubInfo'
import EventView from './pages/EventView'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public screens (no app shell). */}
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* Shareable full-screen event view — public (Feature 2). */}
          <Route path="/events/:id" element={<EventView />} />

          {/* App shell. The dashboard is public; everything else needs a session. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<ProfilePage />} />
              <Route path="/events" element={<EventsMeetings />} />
              {/* Meetings merged into the Events & Meetings tab; keep the old link working. */}
              <Route path="/meetings" element={<Navigate to="/events?tab=meetings" replace />} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/auto-hours" element={<AutoHours />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/ai-planning" element={<AIPlanning />} />
              {/* AI Insights + Studio merged into AI Planning; keep old links working. */}
              <Route path="/insights" element={<Navigate to="/ai-planning" replace />} />
              <Route path="/studio" element={<Navigate to="/ai-planning?tab=studio" replace />} />
              <Route path="/history" element={<History />} />
              <Route path="/requests" element={<HoursRequests />} />
              <Route path="/club" element={<ClubInfo />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
