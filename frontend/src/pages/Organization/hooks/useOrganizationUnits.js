import useOrganizationUnitCrud from "./useOrganizationUnitCrud";
import useOrganizationUnitMove from "./useOrganizationUnitMove";

const useOrganizationUnits = (
    props
) => {

    const crud =
        useOrganizationUnitCrud(
            props
        );


    const move =
        useOrganizationUnitMove(
            props
        );


    return {

        ...crud,

        ...move,

    };
};

export default useOrganizationUnits;