import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { RootLayout } from './components/layout/RootLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

const Landing = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(module => ({ default: module.Onboarding })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Discover = lazy(() => import('./pages/Discover').then(module => ({ default: module.Discover })));
const MovieDetail = lazy(() => import('./pages/MovieDetail').then(module => ({ default: module.MovieDetail })));
const CommunityFeed = lazy(() => import('./pages/CommunityFeed').then(module => ({ default: module.CommunityFeed })));
const Communities = lazy(() => import('./pages/Communities').then(module => ({ default: module.Communities })));
const Messages = lazy(() => import('./pages/Messages').then(module => ({ default: module.Messages })));
const MovieList = lazy(() => import('./pages/MovieList').then(module => ({ default: module.MovieList })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(module => ({ default: module.ResetPassword })));
const TailorFit = lazy(() => import('./pages/TailorFit').then(module => ({ default: module.TailorFit })));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-primary animate-spin" />
  </div>
);
// trigger deployment

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<RootLayout />}>
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/tailor-fit" element={<TailorFit />} />
                  <Route path="/movie/:id" element={<MovieDetail />} />
                  <Route path="/feed" element={<CommunityFeed />} />
                  <Route path="/community" element={<Communities />} />
                  <Route path="/community/:communityId" element={<Communities />} />
                  <Route path="/watchlist" element={<MovieList />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
