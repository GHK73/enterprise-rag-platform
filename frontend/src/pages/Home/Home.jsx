// frontend/src/pages/Home/Home.jsx

import "./Home.css";

function Home() {
    return (
        <section className="home">

            <div className="home-content">

                <span className="home-tag">
                    Enterprise Retrieval-Augmented Generation Platform
                </span>

                <h1 className="home-title">
                    Secure Enterprise AI
                    <br />
                    Powered by Retrieval-Augmented Generation
                </h1>

                <p className="home-description">
                    Build, manage, and query organizational knowledge using a
                    scalable, secure, and explainable RAG platform with
                    enterprise-grade access control and configurable retrieval
                    pipelines.
                </p>

                <div className="home-actions">
                    <button className="primary-btn">
                        Get Started
                    </button>

                    <button className="secondary-btn">
                        Documentation
                    </button>
                </div>

            </div>

        </section>
    );
}

export default Home;