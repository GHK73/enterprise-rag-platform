import { useEffect, useMemo, useState } from "react";

import api from "../../../api/axios";

const useOrganizationRevision = ({
    refreshOrganization,

    onRefresh,

    setError,

    setMessage,
}) => {

    const [
        organizationRevision,
        setOrganizationRevision,
    ] = useState(null);

    const [
        latestOrganizationRevision,
        setLatestOrganizationRevision,
    ] = useState(null);

    const [
        checkingRevision,
        setCheckingRevision,
    ] = useState(false);

    const [
        refreshingOrganization,
        setRefreshingOrganization,
    ] = useState(false);

    const fetchRevision =
        async () => {

            const response =
                await api.get(
                    "/organization/revision"
                );

            return response.data.data.revision;
        };

        const syncOrganizationRevision =
        async () => {
    
            try {
    
                const revision =
                    await fetchRevision();
    
    
                setOrganizationRevision(
                    revision
                );
    
    
                setLatestOrganizationRevision(
                    revision
                );
    
            }
            catch (error) {
    
                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to synchronize organization revision."
                );
            }
        };

    const handleCheckRevision =
        async () => {

            try {

                setCheckingRevision(
                    true
                );

                const revision =
                    await fetchRevision();

                setLatestOrganizationRevision(
                    revision
                );
            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to check organization updates."
                );
            }
            finally {

                setCheckingRevision(
                    false
                );
            }
        };

    const handleRefreshOrganizationChanges =
        async () => {

            if (
                refreshingOrganization
            ) {
                return;
            }

            try {

                setRefreshingOrganization(
                    true
                );

                setError("");
                setMessage("");

                const beforeRevision =
                await fetchRevision();

                await refreshOrganization();

                const afterRevision =await fetchRevision();
                    
                    
                setOrganizationRevision(
                        afterRevision
                    );
                    
                setLatestOrganizationRevision(
                        afterRevision
                    );

                if (
                    beforeRevision !==
                    afterRevision
                ) {

                    setLatestOrganizationRevision(
                        afterRevision
                    );

                    setError(
                        "Organization changed while refreshing. Please refresh again."
                    );

                    return;
                }

                setOrganizationRevision(
                    afterRevision
                );

                setLatestOrganizationRevision(
                    afterRevision
                );

                if (
                    onRefresh
                ) {

                    onRefresh();
                }

                setMessage(
                    "Organization refreshed successfully."
                );
            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to refresh organization."
                );
            }
            finally {

                setRefreshingOrganization(
                    false
                );
            }
        };

    useEffect(() => {

        syncOrganizationRevision();

    }, []);

    useEffect(() => {

        const interval =
            setInterval(
                handleCheckRevision,
                60000
            );

        return () =>
            clearInterval(
                interval
            );

    }, []);

    useEffect(() => {

        const handleVisibilityChange =
            () => {

                if (
                    !document.hidden
                ) {

                    handleCheckRevision();
                }
            };

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return () =>
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

    }, []);

    const hasOrganizationUpdates =
        useMemo(() => {

            if (
                organizationRevision ===
                    null ||
                latestOrganizationRevision ===
                    null
            ) {
                return false;
            }

            return (
                latestOrganizationRevision >
                organizationRevision
            );

        }, [
            organizationRevision,
            latestOrganizationRevision,
        ]);

    return {

        organizationRevision,

        latestOrganizationRevision,

        checkingRevision,

        refreshingOrganization,

        hasOrganizationUpdates,

        syncOrganizationRevision,

        handleCheckRevision,

        handleRefreshOrganizationChanges,
    };
};

export default useOrganizationRevision;