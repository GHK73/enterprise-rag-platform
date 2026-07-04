// frontend/src/pages/Login/Login.jsx

import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../api/axios";
import "./Login.css";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    async function handleSubmit(event) {
        event.preventDefault();

        setError("");

        try {
            const response = await api.post("/auth/login", {
                email,
                password,
            });

            const token = response.data.data.token;

            login(token);

            navigate("/");
        } catch (error) {
            setError(
                error.response?.data?.message || "Login failed"
            );
        }
    }

    return (
        <section className="login-page">

            <div className="login-container">

                <div className="login-header">
                    <h1>Welcome Back</h1>

                    <p>
                        Sign in to access your enterprise knowledge workspace.
                    </p>
                </div>

                {error && (
                    <p className="login-error">
                        {error}
                    </p>
                )}

                <form
                    className="login-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            type="email"
                            id="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            type="password"
                            id="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="login-submit-btn">
                        Sign In
                    </button>

                </form>

                <p className="login-footer">
                    Don't have an account?{" "}
                    <Link to="/register">
                        Create account
                    </Link>
                </p>

            </div>

        </section>
    );
}

export default Login;