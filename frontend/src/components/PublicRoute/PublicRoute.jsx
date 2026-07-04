import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

function PublicRoute({ children }) {
    const { token } = useContext(AuthContext);

    if (token) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default PublicRoute;