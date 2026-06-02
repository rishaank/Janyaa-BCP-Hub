import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import ProfilePage from './pages/ProfilePage'
import Events from './pages/Events'
import Fundraising from './pages/Fundraising'
import Locations from './pages/Locations'
import Restaurants from './pages/Restaurants'
import Insights from './pages/Insights'
import History from './pages/History'
import ClubInfo from './pages/ClubInfo'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public auth screens (no app shell). */}
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />

          {/* Everything else requires a session and renders in the sidebar layout. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<ProfilePage />} />
              <Route path="/events" element={<Events />} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/insights" element={<Insights />} />
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
