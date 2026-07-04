// frontend/src/context/AuthContext.jsx

import {
    createContext,
    useEffect,
    useState,
} from "react";
import api from "../api/axios";

export const AuthContext = createContext();

function AuthProvider({ children }) {
    const [token, setToken] = useState(
        localStorage.getItem("token")
    );
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function login(token) {
        localStorage.setItem("token", token);
        setToken(token);
    }

    function logout() {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    }

    async function refreshUser() {
        const response = await api.get("/auth/me");

        setUser(response.data.data);

        return response.data.data;
    }

    useEffect(() => {
        async function verifySession() {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                await refreshUser();
            } catch (error) {
                logout();
            } finally {
                setLoading(false);
            }
        }

        verifySession();
    }, [token]);

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                loading,
                login,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export default AuthProvider;