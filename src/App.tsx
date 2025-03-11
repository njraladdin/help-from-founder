import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import EditProject from './pages/EditProject';
import ProjectPage from './pages/ProjectPage';
import ThreadPage from './pages/ThreadPage';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="dashboard/new-project" element={
              <ProtectedRoute>
                <NewProject />
              </ProtectedRoute>
            } />
            <Route path="dashboard/edit-project/:projectId" element={
              <ProtectedRoute>
                <EditProject />
              </ProtectedRoute>
            } />
            <Route path=":projectSlug" element={<ProjectPage />} />
            <Route path=":projectSlug/thread/:threadId" element={<ThreadPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
