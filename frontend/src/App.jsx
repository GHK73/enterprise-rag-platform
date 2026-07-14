import "./App.css";

import {
    Routes,
    Route,
} from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";

import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";

import Dashboard from "./pages/Dashboard/Dashboard";
import CreateOrganization from "./pages/CreateOrganization/CreateOrganization";
import Organization from "./pages/Organization/Organization";
import Permissions from "./pages/Permissions/Permissions";
import Invitations from "./pages/Invitations/Invitations";

import PublicRoute from "./components/PublicRoute/PublicRoute";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

import { documentRoutes } from "./routes/DocumentRoutes";

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
                element={
                    <ProtectedRoute>
                        <PublicLayout />
                    </ProtectedRoute>
                }
            >

                <Route
                    path="/dashboard"
                    element={<Dashboard />}
                />

                <Route
                    path="/organization"
                    element={<Organization />}
                />

                <Route
                    path="/create-organization"
                    element={<CreateOrganization />}
                />

                <Route
                    path="/permissions"
                    element={<Permissions />}
                />

                <Route
                    path="/invitations"
                    element={<Invitations />}
                />

                {documentRoutes}

            </Route>

        </Routes>

    );

}

export default App;