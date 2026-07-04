// frontend/src/components/PublicRoute/PublicRoute.jsx

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

function PublicRoute({ children }) {
    const { token, loading } = useContext(AuthContext);

    if (loading) {
        return null;
    }

    if (token) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default PublicRoute;