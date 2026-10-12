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

    const [formError, setFormError] =
        useState("");

    const utcToLocalDatetime = (utcString) => {
        if (!utcString) return "";
        const date = new Date(utcString);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const localDatetimeToUtc = (localString) => {
        if (!localString) return null;
        const date = new Date(localString);
        const offset = date.getTimezoneOffset() * 60000;
        const utcDate = new Date(date.getTime() + offset);
        return utcDate.toISOString();
    };

    const validateForm = () => {
        if (
            subjectType !==
                "ORGANIZATION" &&
            !subjectId
        ) {
            setFormError("Please select a subject.");
            return false;
        }

        if (
            subjectType ===
                "ORGANIZATION" &&
            !organization?.id
        ) {
            setFormError("Organization not loaded yet.");
            return false;
        }

        if (
            subjectType === "UNIT" &&
            !scope
        ) {
            setFormError("Please select a scope for the unit.");
            return false;
        }

        if (
            temporary &&
            !expiresAt
        ) {
            setFormError("Please select an expiry date for temporary access.");
            return false;
        }

        if (temporary && expiresAt) {
            const now = new Date();
            const expiry = new Date(expiresAt);
            const maxExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            if (expiry <= now) {
                setFormError("Expiry must be in the future.");
                return false;
            }

            if (expiry > maxExpiry) {
                setFormError("Temporary access cannot exceed 7 days.");
                return false;
            }
        }

        setFormError("");
        return true;
    };

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
                ? utcToLocalDatetime(
                      initialValues.validUntil
                  )
                : initialValues.expiresAt
                ? utcToLocalDatetime(
                      initialValues.expiresAt
                  )
                : ""
        );

        setReason(
            initialValues.reason || ""
        );
    }, [
        editing,
        initialValues,
    ]);

    useEffect(() => {
        setSubjectId("");
        setScope("UNIT_ONLY");
        setFormError("");
    }, [subjectType]);

    const resetForm = () => {
        setSubjectType("USER");
        setSubjectId("");
        setAction("QUERY");
        setPermission("ALLOW");
        setScope("UNIT_ONLY");
        setTemporary(false);
        setExpiresAt("");
        setReason("");
        setFormError("");
    };

    const handleSubmit = async (
        event
    ) => {
        event.preventDefault();

        if (!validateForm()) {
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
                    ? localDatetimeToUtc(expiresAt)
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
            accessData,
            temporary
        );

        resetForm();

        if (editing) {
            onCancel?.();
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
                        min={new Date().toISOString().slice(0, 16)}
                    />

                    <small className="form-helper">
                        Maximum 7 days from now.
                    </small>
                </div>
            )}

            {formError && (
                <div className="form-error">
                    {formError}
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