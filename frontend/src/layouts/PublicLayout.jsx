// frontend/src/layouts/PublicLayout.jsx

import Navbar from "../components/Navbar/Navbar";

function PublicLayout({ children }) {
    return (
        <>
            <Navbar />

            <main>
                {children}
            </main>
        </>
    );
}

export default PublicLayout;