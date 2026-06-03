import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import Events from './pages/Events'
import Meetings from './pages/Meetings'
import Fundraising from './pages/Fundraising'
import Goals from './pages/Goals'
import AutoHours from './pages/AutoHours'
import Locations from './pages/Locations'
import Restaurants from './pages/Restaurants'
import Insights from './pages/Insights'
import AIStudio from './pages/AIStudio'
import History from './pages/History'
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
              <Route path="/events" element={<Events />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/auto-hours" element={<AutoHours />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/studio" element={<AIStudio />} />
              <Route path="/history" element={<History />} />
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
