import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Events from './pages/Events'
import Fundraising from './pages/Fundraising'
import Locations from './pages/Locations'
import Restaurants from './pages/Restaurants'
import Insights from './pages/Insights'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth screen (no app shell). */}
          <Route path="/login" element={<Login />} />

          {/* Everything else requires a session and renders in the sidebar layout. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/events" element={<Events />} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/insights" element={<Insights />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
