import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import ProjectPage from './pages/ProjectPage';

function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectPage />} />
          <Route path="/projects" element={<ProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/files/*" element={<ProjectPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
