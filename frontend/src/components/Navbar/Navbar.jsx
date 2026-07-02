import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
    return (
        <header className="navbar">
            <div className="navbar-container">

                <div className="navbar-left">
                    <Link to="/" className="navbar-logo">
                        Enterprise RAG
                    </Link>
                </div>

                <div className="navbar-center">
                    <nav className="navbar-links">
                        <Link to="/">Home</Link>
                        <Link to="/">Features</Link>
                        <Link to="/">Documentation</Link>
                        <Link to="/">GitHub</Link>
                    </nav>
                </div>

                <div className="navbar-actions">
                    <Link to="/login" className="login-btn">
                        Login
                    </Link>

                    <Link to="/register" className="register-btn">
                        Register
                    </Link>
                </div>

            </div>
        </header>   
    );
}

export default Navbar;