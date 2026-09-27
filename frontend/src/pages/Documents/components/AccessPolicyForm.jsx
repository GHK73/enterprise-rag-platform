import {
    useEffect,
    useState,
} from "react";

import SubjectSelector from "./SubjectSelector";
import SubjectValueSelector from "./SubjectValueSelector";

const AccessPolicyForm = ({
    organization,
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

    const [action, setAction] =
        useState("QUERY");

    const [permission, setPermission] =
        useState("ALLOW");

    const [scope, setScope] =
        useState("UNIT_ONLY");

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
                initialValues.subjectOrganizationId ||
                ""
        );

        setAction(
            initialValues.action ||
                "QUERY"
        );

        setPermission(
            initialValues.effect ||
                initialValues.permission ||
                "ALLOW"
        );

        setScope(
            initialValues.scope ||
                "UNIT_ONLY"
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
        setAction("QUERY");
        setPermission("ALLOW");
        setScope("UNIT_ONLY");
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
            subjectType ===
                "ORGANIZATION" &&
            !organization?.id
        ) {
            return;
        }

        if (
            subjectType === "UNIT" &&
            !scope
        ) {
            return;
        }

        if (
            temporary &&
            !expiresAt
        ) {
            return;
        }

        const accessData = {
            subjectType,
            action,
            effect: permission,
            scope:
                subjectType === "UNIT"
                    ? scope
                    : undefined,
            validUntil:
                temporary
                    ? new Date(
                          expiresAt
                      ).toISOString()
                    : null,
            reason,
        };

        if (
            subjectType ===
            "ORGANIZATION"
        ) {
            accessData.subjectOrganizationId =
                organization.id;
        }

        if (
            subjectType === "UNIT"
        ) {
            accessData.subjectUnitId =
                subjectId;
        }

        if (
            subjectType === "ROLE"
        ) {
            accessData.subjectRole =
                subjectId;
        }

        if (
            subjectType === "USER"
        ) {
            accessData.subjectUserId =
                subjectId;
        }

        await onSubmit(
            accessData
        );

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
                organization={organization}
                units={units}
                members={members}
                value={subjectId}
                onChange={setSubjectId}
                scope={scope}
                onScopeChange={setScope}
            />

            <div className="form-group">
                <label>
                    Action
                </label>

                <select
                    value={action}
                    onChange={(
                        event
                    ) =>
                        setAction(
                            event.target
                                .value
                        )
                    }
                    disabled={editing}
                >
                    <option value="QUERY">
                        QUERY
                    </option>

                    <option value="VIEW">
                        VIEW
                    </option>

                    <option value="DOWNLOAD">
                        DOWNLOAD
                    </option>

                    <option value="MANAGE_ACCESS">
                        MANAGE_ACCESS
                    </option>
                </select>

                {editing && (
                    <small className="form-helper">
                        Action cannot be changed when editing an existing policy.
                    </small>
                )}
            </div>

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