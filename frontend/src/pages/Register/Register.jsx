// frontend/src/pages/Register/Register.jsx

import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../api/axios";
import "./Register.css";

function Register() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    async function handleSubmit(event) {
        event.preventDefault();
    
        setError("");
    
        try {
            const response = await api.post("/auth/register", {
                fullName,
                email,
                password,
            });
    
            const token = response.data.data.token;
            login(token);
            navigate("/");
    
            localStorage.setItem("token", token);
    
            navigate("/");
        } catch (error) {
            setError(
                error.response?.data?.message || "Registration failed"
            );
        }
    }

    return (
        <section className="register-page">

            <div className="register-container">

                <div className="register-header">
                    <h1>Create Account</h1>

                    <p>
                        Create your account to start building your enterprise
                        knowledge workspace.
                    </p>
                </div>
                {error && (
                    <p className="register-error">
                        {error}
                    </p>
                )}

                <form
                    className="register-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label htmlFor="fullName">
                            Name
                        </label>

                        <input
                            type="text"
                            id="fullName"
                            placeholder="Enter your name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            required
                        />
                    </div>

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
                            placeholder="Create a password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="register-submit-btn">
                        Create Account
                    </button>

                </form>

                <p className="register-footer">
                    Already have an account?{" "}
                    <Link to="/login">
                        Sign in
                    </Link>
                </p>

            </div>

        </section>
    );
}

export default Register;