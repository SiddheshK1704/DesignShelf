import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Placeholder } from './pages/Placeholder';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="library" element={<Placeholder title="Library" />} />
        <Route path="find" element={<Placeholder title="Find references" />} />
        <Route path="boards" element={<Placeholder title="Boards" />} />
        <Route path="help" element={<Placeholder title="How it works" />} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Placeholder title="Page not found" notFound />} />
      </Route>
    </Routes>
  );
}
