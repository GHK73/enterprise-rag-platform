import {
    useEffect,
    useState,
} from "react";

import SubjectSelector from "./SubjectSelector";
import SubjectValueSelector from "./SubjectValueSelector";

const AccessPolicyForm = ({
    units,
    members,
    onSubmit,
    loading,

    editing = false,
    initialValues = null,
    onCancel,
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

    useEffect(() => {
        if (!editing || !initialValues) {
            return;
        }

        setSubjectType(
            initialValues.subjectType ||
                "USER"
        );

        setSubjectId(
            initialValues.subjectUserId ||
                initialValues.subjectUnitId ||
                initialValues.subjectRole ||
                ""
        );

        setPermission(
            initialValues.effect ||
                initialValues.permission ||
                "ALLOW"
        );

        setTemporary(
            Boolean(
                initialValues.validUntil ||
                    initialValues.expiresAt
            )
        );

        setExpiresAt(
            initialValues.validUntil
                ? new Date(
                      initialValues.validUntil
                  )
                      .toISOString()
                      .slice(0, 16)
                : initialValues.expiresAt
                ? new Date(
                      initialValues.expiresAt
                  )
                      .toISOString()
                      .slice(0, 16)
                : ""
        );

        setReason(
            initialValues.reason || ""
        );
    }, [
        editing,
        initialValues,
    ]);

    const resetForm = () => {
        setSubjectType("USER");
        setSubjectId("");
        setPermission("ALLOW");
        setTemporary(false);
        setExpiresAt("");
        setReason("");
    };

    const handleSubmit = async (
        event
    ) => {
        event.preventDefault();

        if (
            subjectType !==
                "ORGANIZATION" &&
            !subjectId
        ) {
            return;
        }

        if (
            temporary &&
            !expiresAt
        ) {
            return;
        }

        await onSubmit({
            subjectType,
            subjectId,
            permission,
            temporary,
            expiresAt,
            reason,
        });

        if (!editing) {
            resetForm();
        }
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

            <SubjectValueSelector
                subjectType={subjectType}
                units={units}
                members={members}
                value={subjectId}
                onChange={setSubjectId}
            />

            <div className="form-group">
                <label>
                    Permission
                </label>

                <select
                    value={permission}
                    onChange={(
                        event
                    ) =>
                        setPermission(
                            event.target
                                .value
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
                    onChange={(
                        event
                    ) =>
                        setTemporary(
                            event.target
                                .checked
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
                        required
                        value={expiresAt}
                        onChange={(
                            event
                        ) =>
                            setExpiresAt(
                                event.target
                                    .value
                            )
                        }
                    />
                </div>
            )}

            <div className="form-group">
                <label>
                    Reason
                </label>

                <textarea
                    rows={3}
                    value={reason}
                    onChange={(
                        event
                    ) =>
                        setReason(
                            event.target
                                .value
                        )
                    }
                    placeholder="Optional reason"
                />
            </div>

            <div className="form-actions">

                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >
                    {loading
                        ? editing
                            ? "Updating..."
                            : "Creating..."
                        : editing
                        ? "Update Policy"
                        : "Grant Access"}
                </button>

                {editing && (
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                            resetForm();

                            onCancel?.();
                        }}
                    >
                        Cancel
                    </button>
                )}

            </div>
        </form>
    );
};

export default AccessPolicyForm;