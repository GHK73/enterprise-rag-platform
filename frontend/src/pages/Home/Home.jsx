// frontend/src/pages/Home/Home.jsx

import "./Home.css";

function Home() {
    return (
        <main className="home">

            <section className="hero-section">

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

            <section className="features-section">

                <div className="section-heading">
                    <span className="section-tag">
                        Platform Capabilities
                    </span>

                    <h2>
                        Built for Enterprise Knowledge
                    </h2>

                    <p>
                        Securely transform organizational documents into
                        searchable and explainable AI-powered knowledge.
                    </p>
                </div>

                <div className="features-grid">

                    <article className="feature-card">
                        <h3>Secure Access</h3>

                        <p>
                            Protect organizational knowledge with role-based
                            access control and isolated enterprise workspaces.
                        </p>
                    </article>

                    <article className="feature-card">
                        <h3>Intelligent Retrieval</h3>

                        <p>
                            Retrieve relevant information from enterprise
                            documents using configurable retrieval pipelines.
                        </p>
                    </article>

                    <article className="feature-card">
                        <h3>Explainable Answers</h3>

                        <p>
                            Generate grounded AI responses with source citations
                            for transparent and verifiable answers.
                        </p>
                    </article>

                </div>

            </section>

            <section className="architecture-section">

                <div className="architecture-content">

                    <div>
                        <span className="section-tag">
                            Enterprise Architecture
                        </span>

                        <h2>
                            From Documents to Reliable Answers
                        </h2>
                    </div>

                    <p>
                        Ingest organizational documents, process and index
                        enterprise knowledge, retrieve relevant context, and
                        generate grounded responses through one secure platform.
                    </p>

                </div>

            </section>

        </main>
    );
}

export default Home;