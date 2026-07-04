import './App.css';
import { Routes, Route } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import PublicRoute from "./components/PublicRoute/PublicRoute";
import CreateOrganization from "./pages/CreateOrganization/CreateOrganization.jsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import Organization from "./pages/Organization/Organization.jsx";

function App() {
    return (
        <Routes>
            <Route
                path="/"
                element={
                    <PublicLayout>
                        <Home />
                    </PublicLayout>
                }
            />

            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <PublicLayout>
                            <Login />
                        </PublicLayout>
                    </PublicRoute>
                }
            />

            <Route
                path="/register"
                element={
                    <PublicRoute>
                        <PublicLayout>
                            <Register />
                        </PublicLayout>
                    </PublicRoute>
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organization"
                element={
                    <ProtectedRoute>
                        <Organization />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/create-organization"
                element={
                    <ProtectedRoute>
                        <CreateOrganization />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default App;