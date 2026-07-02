import Navbar from "../components/Navbar/Navbar";

function PublicLayout({children}){
    return(
        <>
        <Navbar>
            <main>
                {children}
            </main>
        </Navbar>
        </>
    );
}

export default PublicLayout;