import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProjectPage from './pages/ProjectPage';
import CodeViewPage from './pages/CodeViewPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/files/*" element={<CodeViewPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
