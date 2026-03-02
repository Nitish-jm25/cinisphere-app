import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './components/layout/RootLayout';
import { AppProvider } from './context/AppContext';

import { Landing } from './pages/Landing';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { MovieDetail } from './pages/MovieDetail';
import { CommunityFeed } from './pages/CommunityFeed';
import { Communities } from './pages/Communities';
import { Profile } from './pages/Profile';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<RootLayout />}>
            <Route path="/discover" element={<Home />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/feed" element={<CommunityFeed />} />
            <Route path="/community" element={<Communities />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
