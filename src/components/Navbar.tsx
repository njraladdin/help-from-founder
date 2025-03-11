import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <nav className="border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2 text-lg font-medium text-gray-900">
            <img src="/logo.svg" alt="Help From Founder Logo" className="h-8 w-8" />
            <span>Help From Founder</span>
          </Link>
          <div className="flex space-x-6">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
              Home
            </Link>
            {currentUser ? (
              <>
                <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Login
                </Link>
                <Link to="/register" className="text-sm text-gray-600 hover:text-gray-900">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 