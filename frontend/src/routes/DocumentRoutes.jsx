import { Route } from "react-router-dom";

import DocumentLibrary from "../pages/Documents/DocumentLibrary";
import CreateDocument from "../pages/Documents/CreateDocument";
import UploadDocument from "../pages/Documents/UploadDocument";
import DocumentDetails from "../pages/Documents/DocumentDetails";
import DocumentProcessingQueue from "../pages/Documents/DocumentProcessingQueue";

export const documentRoutes = (
    <>

        <Route
            path="/documents"
            element={<DocumentLibrary />}
        />

        <Route
            path="/documents/queue"
            element={<DocumentProcessingQueue />}
        />

        <Route
            path="/documents/new"
            element={<CreateDocument />}
        />

        <Route
            path="/documents/:documentId/upload"
            element={<UploadDocument />}
        />

        <Route
            path="/documents/:documentId"
            element={<DocumentDetails />}
        />

    </>
);