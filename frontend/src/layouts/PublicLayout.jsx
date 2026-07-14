import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar/Navbar";

function PublicLayout({ children }) {
    return (
        <>
            <Navbar />

            <main>
                {children || <Outlet />}
            </main>
        </>
    );
}

export default PublicLayout;