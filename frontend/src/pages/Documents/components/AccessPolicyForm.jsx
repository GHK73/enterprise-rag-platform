import { useState } from "react";
import SubjectSelector from "./SubjectSelector";
import SubjectValueSelector from "./SubjectValueSelector";

const AccessPolicyForm = ({
    units,
    members,
    onSubmit,
    loading,
}) => {
    const [subjectType, setSubjectType] =
        useState("USER");

    const [subjectId, setSubjectId] =
        useState("");

    const [permission, setPermission] =
        useState("ALLOW");

    const [temporary, setTemporary] =
        useState(false);

    const [expiresAt, setExpiresAt] =
        useState("");

    const [reason, setReason] =
        useState("");

    const handleSubmit = (event) => {
        event.preventDefault();

        onSubmit({
            subjectType,
            subjectId,
            permission,
            temporary,
            expiresAt,
            reason,
        });
    };

    return (
        <form
            className="access-policy-form"
            onSubmit={handleSubmit}
        >

            <SubjectSelector
                value={subjectType}
                onChange={setSubjectType}
            />

            <div className="form-group">

                <label>
                    Subject ID
                </label>

                <input
                    type="text"
                    value={subjectId}
                    onChange={(event) =>
                        setSubjectId(
                            event.target.value
                        )
                    }
                    placeholder="Enter subject id"
                />

            </div>

            <div className="form-group">

                <label>
                    Permission
                </label>

                <select
                    value={permission}
                    onChange={(event) =>
                        setPermission(
                            event.target.value
                        )
                    }
                >

                    <option value="ALLOW">
                        ALLOW
                    </option>

                    <option value="DENY">
                        DENY
                    </option>

                </select>

            </div>

            <div className="form-checkbox">

                <input
                    id="temporary-access"
                    type="checkbox"
                    checked={temporary}
                    onChange={(event) =>
                        setTemporary(
                            event.target.checked
                        )
                    }
                />

                <label htmlFor="temporary-access">
                    Temporary Access
                </label>

            </div>

            {temporary && (

                <div className="form-group">

                    <label>
                        Expires At
                    </label>

                    <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(event) =>
                            setExpiresAt(
                                event.target.value
                            )
                        }
                    />

                </div>

            )}

                <SubjectValueSelector
                    subjectType={subjectType}
                    units={units}
                    members={members}
                    value={subjectId}
                    onChange={setSubjectId}
                />

            <button
                type="submit"
                className="primary-button"
                disabled={loading}
            >
                {loading
                    ? "Saving..."
                    : "Save Policy"}
            </button>

        </form>
    );
};

export default AccessPolicyForm;