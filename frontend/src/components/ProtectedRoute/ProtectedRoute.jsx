// frontend/src/components/ProtectedRoute/ProtectedRoute.jsx

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

function ProtectedRoute({ children }) {
    const { token, loading } = useContext(AuthContext);

    if (loading) {
        return null;
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;