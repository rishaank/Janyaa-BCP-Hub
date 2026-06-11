import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'

// Every other page is code-split: it loads on first visit, so the initial
// bundle stays lean (Leaflet, Recharts, and the cropper land in their own
// chunks instead of blocking the public dashboard).
const SetPassword = lazy(() => import('./pages/SetPassword'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const EventView = lazy(() => import('./pages/EventView'))
const Members = lazy(() => import('./pages/Members'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EventsMeetings = lazy(() => import('./pages/EventsMeetings'))
const Fundraising = lazy(() => import('./pages/Fundraising'))
const ClubTerms = lazy(() => import('./pages/ClubTerms'))
const Goals = lazy(() => import('./pages/Goals'))
const AutoHours = lazy(() => import('./pages/AutoHours'))
const Locations = lazy(() => import('./pages/Locations'))
const Restaurants = lazy(() => import('./pages/Restaurants'))
const AIPlanning = lazy(() => import('./pages/AIPlanning'))
const History = lazy(() => import('./pages/History'))
const HoursRequests = lazy(() => import('./pages/HoursRequests'))
const ClubInfo = lazy(() => import('./pages/ClubInfo'))

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <p className="text-sm text-ink-400">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
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
                {/* Club terms — /terms is taken by the legal Terms page. */}
                <Route path="/club-terms" element={<ClubTerms />} />
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
          </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
