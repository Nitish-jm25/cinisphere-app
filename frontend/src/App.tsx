import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { RootLayout } from './components/layout/RootLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';

import { Landing } from './pages/Landing';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { MovieDetail } from './pages/MovieDetail';
import { CommunityFeed } from './pages/CommunityFeed';
import { Communities } from './pages/Communities';
import { Profile } from './pages/Profile';
import { TailorFit } from './pages/TailorFit';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<RootLayout />}>
                <Route path="/discover" element={<Discover />} />
                <Route path="/home" element={<Home />} />
                <Route path="/tailor-fit" element={<TailorFit />} />
                <Route path="/movie/:id" element={<MovieDetail />} />
                <Route path="/feed" element={<CommunityFeed />} />
                <Route path="/community" element={<Communities />} />
                <Route path="/community/:communityId" element={<Communities />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:username" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
