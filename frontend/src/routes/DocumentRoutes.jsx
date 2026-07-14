import { Route } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute/ProtectedRoute";
import PublicLayout from "../layouts/PublicLayout";

import DocumentLibrary from "../pages/Documents/DocumentLibrary";
import CreateDocument from "../pages/Documents/CreateDocument";
import UploadDocument from "../pages/Documents/UploadDocument";
import DocumentDetails from "../pages/Documents/DocumentDetails";


export const documentRoutes = (
    <>
        <Route
            path="/documents"
            element={
                <ProtectedRoute>
                    <PublicLayout>
                        <DocumentLibrary />
                    </PublicLayout>
                </ProtectedRoute>
            }
        />


        <Route
            path="/documents/new"
            element={
                <ProtectedRoute>
                    <PublicLayout>
                        <CreateDocument />
                    </PublicLayout>
                </ProtectedRoute>
            }
        />


        <Route
            path="/documents/:documentId/upload"
            element={
                <ProtectedRoute>
                    <PublicLayout>
                        <UploadDocument />
                    </PublicLayout>
                </ProtectedRoute>
            }
        />


        <Route
            path="/documents/:documentId"
            element={
                <ProtectedRoute>
                    <PublicLayout>
                        <DocumentDetails />
                    </PublicLayout>
                </ProtectedRoute>
            }
        />
    </>
);