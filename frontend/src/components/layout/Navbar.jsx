import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SR</span>
            </div>
            <span className="font-bold text-gray-900">ResultPortal</span>
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <Link
                  to={user.role === "teacher" ? "/teacher" : ["admin", "super_admin"].includes(user.role) ? "/admin" : "/student"}
                  className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  Dashboard
                </Link>
                {["admin", "super_admin"].includes(user.role) && (
                  <Link
                    to="/admin"
                    className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Admin Panel
                  </Link>
                )}
                {user.role === "teacher" && (
                  <Link
                    to="/teacher/analytics"
                    className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Analytics
                  </Link>
                )}
                {user.role === "student" && (
                  <Link
                    to="/student/upload"
                    className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Upload Result
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 font-semibold text-sm">
                    {user.name[0].toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
