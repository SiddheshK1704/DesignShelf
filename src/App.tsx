import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Assistant } from './pages/Assistant';
import { Boards, BoardDetail } from './pages/Boards';
import { Help } from './pages/Help';
import { Landing } from './pages/Landing';
import { Library } from './pages/Library';
import { Placeholder } from './pages/Placeholder';
import { Reference } from './pages/Reference';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="ref/:slug" element={<Reference />} />
        <Route path="library" element={<Library />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="boards" element={<Boards />} />
        <Route path="boards/:boardId" element={<BoardDetail />} />
        <Route path="help" element={<Help />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Placeholder title="Page not found" notFound />} />
      </Route>
    </Routes>
  );
}
