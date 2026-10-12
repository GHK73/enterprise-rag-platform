import { Link } from "react-router-dom";
import "./NotFound.css";

const NotFound = () => {
    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <h1>404</h1>
                <h2>Page Not Found</h2>
                <p>The page you are looking for does not exist.</p>
                <Link to="/dashboard" className="primary-button">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
};

export default NotFound;