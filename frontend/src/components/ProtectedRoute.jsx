import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = Array.isArray(role) ? role : role ? [role] : [];
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    const redirectMap = {
      super_admin: "/admin",
      admin: "/admin",
      teacher: "/teacher",
      student: "/student",
    };
    return <Navigate to={redirectMap[user.role] || "/"} replace />;
  }

  return children;
};

export default ProtectedRoute;
