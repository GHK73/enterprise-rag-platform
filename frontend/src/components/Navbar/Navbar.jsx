// frontend/src/components/Navbar/Navbar.jsx

import {useContext, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {AuthContext} from "../../context/AuthContext";
import "./Navbar.css";

function Navbar(){
    const [menuOpen,setMenuOpen] = useState(false);

    const {token,logout} = useContext(AuthContext);
    const navigate = useNavigate();

    function toggleMenu(){
        setMenuOpen(!menuOpen);
    }

    function closeMenu(){
        setMenuOpen(false);
    }

    function handleLogout(){
        logout();
        closeMenu();
        navigate("/");
    }

    return (
        <header className="navbar">
            <div className="navbar-container">
                <div className="navbar-left">
                    <Link
                        to={token ? "/dashboard" : "/"}
                        className="navbar-logo"
                        onClick={closeMenu}
                    >
                        Enterprise RAG
                    </Link>
                </div>

                <div className={`navbar-center ${menuOpen ? "active" : ""}`}>
                    <nav className="navbar-links">
                        {token ? (
                            <>
                                <Link
                                    to="/dashboard"
                                    onClick={closeMenu}
                                >
                                    Dashboard
                                </Link>

                                <Link
                                    to="/organization"
                                    onClick={closeMenu}
                                >
                                    Organization
                                </Link>
                                <Link
                                    to="/permissions"
                                    onClick={closeMenu}
                                >
                                    Permissions
                                </Link>
                                <Link
                                    to="/invitations"
                                    onClick={closeMenu}
                                >
                                    Invitations
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/" onClick={closeMenu}>
                                    Home
                                </Link>

                                <Link to="/" onClick={closeMenu}>
                                    Features
                                </Link>

                                <Link to="/" onClick={closeMenu}>
                                    Documentation
                                </Link>

                                <Link to="/" onClick={closeMenu}>
                                    GitHub
                                </Link>
                            </>
                        )}
                    </nav>

                    <div className="mobile-actions">
                        {token ? (
                            <button
                                className="login-btn"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="login-btn"
                                    onClick={closeMenu}
                                >
                                    Login
                                </Link>

                                <Link
                                    to="/register"
                                    className="register-btn"
                                    onClick={closeMenu}
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="navbar-actions">
                    {token ? (
                        <button
                            className="login-btn"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>
                    ) : (
                        <>
                            <Link to="/login" className="login-btn">
                                Login
                            </Link>

                            <Link to="/register" className="register-btn">
                                Register
                            </Link>
                        </>
                    )}
                </div>

                <button
                    className="menu-btn"
                    onClick={toggleMenu}
                    aria-label="Toggle navigation menu"
                >
                    {menuOpen ? "✕" : "☰"}
                </button>
            </div>
        </header>
    );
}

export default Navbar;