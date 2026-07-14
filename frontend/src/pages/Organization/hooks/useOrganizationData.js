import { useCallback, useEffect, useState } from "react";

import api from "../../../api/axios";

const useOrganizationData = () => {

    const [organization, setOrganization] =
        useState(null);

    const [
        organizationUnits,
        setOrganizationUnits,
    ] = useState([]);

    const [
        organizationMembers,
        setOrganizationMembers,
    ] = useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [message, setMessage] =
        useState("");

    const refreshOrganization =
        useCallback(async () => {

            try {

                setLoading(true);

                setError("");

                const [

                    organizationResponse,

                    unitsResponse,

                    membersResponse,

                ] = await Promise.all([

                    api.get(
                        "/organization"
                    ),

                    api.get(
                        "/organization/units"
                    ),

                    api.get(
                        "/organization/members"
                    ),

                ]);

                setOrganization(
                    organizationResponse.data.data
                );

                setOrganizationUnits(
                    unitsResponse.data.data
                );

                setOrganizationMembers(
                    membersResponse.data.data
                );

            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to load organization."
                );
            }
            finally {

                setLoading(false);
            }

        }, []);

    useEffect(() => {

        refreshOrganization();

    }, [refreshOrganization]);

    const clearMessages =
        () => {

            setError("");

            setMessage("");
        };

        return {

            organization,
        
            organizationUnits,
            setOrganizationUnits,
        
            organizationMembers,
            setOrganizationMembers,
        
            loading,
        
            error,
            setError,
        
            message,
            setMessage,
        
            refreshOrganization,
        
        };
};

export default useOrganizationData;