import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    policyMatchesUser,
    evaluatePolicyMatches,
    resolvePolicyDecision,
} from "../src/services/document/documentAccess.service.js";

/*
 * The access-control matcher is the security
 * core of the platform: it decides whether a
 * policy grants a user access. All
 * authorization paths (single-action, batched
 * listing, query authorization, access-scope
 * fingerprint) resolve through it, so these
 * rules are tested once, here.
 */

const user = {
    id: "user-1",
    role: "MEMBER",
    unitId: "unit-2",
    unit: {
        id: "unit-2",
        organizationId: "org-1",
    },
};

/*
 * unit-2 sits below unit-1 below the
 * organization root.
 */
const hierarchy = new Set([
    "unit-2",
    "unit-1",
    "root-unit",
]);

const activePolicy = (overrides = {}) => ({
    isActive: true,
    validFrom: null,
    validUntil: null,
    ...overrides,
});

test("ORGANIZATION subject matches the policy organization", () => {
    const policy = activePolicy({
        subjectType: "ORGANIZATION",
        subjectOrganizationId: "org-1",
    });
    assert.equal(policyMatchesUser(policy, user, hierarchy), true);

    const foreign = activePolicy({
        subjectType: "ORGANIZATION",
        subjectOrganizationId: "org-2",
    });
    assert.equal(policyMatchesUser(foreign, user, hierarchy), false);
});

test("ROLE subject matches the user role", () => {
    const policy = activePolicy({
        subjectType: "ROLE",
        subjectRole: "MEMBER",
    });
    assert.equal(policyMatchesUser(policy, user, hierarchy), true);

    const other = activePolicy({
        subjectType: "ROLE",
        subjectRole: "ADMIN",
    });
    assert.equal(policyMatchesUser(other, user, hierarchy), false);
});

test("USER subject matches the user id", () => {
    const policy = activePolicy({
        subjectType: "USER",
        subjectUserId: "user-1",
    });
    assert.equal(policyMatchesUser(policy, user, hierarchy), true);

    const other = activePolicy({
        subjectType: "USER",
        subjectUserId: "user-2",
    });
    assert.equal(policyMatchesUser(other, user, hierarchy), false);
});

test("UNIT_ONLY scope matches only the exact unit", () => {
    const exact = activePolicy({
        subjectType: "UNIT",
        subjectUnitId: "unit-2",
        scope: "UNIT_ONLY",
    });
    assert.equal(policyMatchesUser(exact, user, hierarchy), true);

    /*
     * The user's unit is a descendant of
     * unit-1, but UNIT_ONLY does not inherit
     * downwards or upwards.
     */
    const parent = activePolicy({
        subjectType: "UNIT",
        subjectUnitId: "unit-1",
        scope: "UNIT_ONLY",
    });
    assert.equal(policyMatchesUser(parent, user, hierarchy), false);
});

test("UNIT_AND_DESCENDANTS scope matches ancestor scopes", () => {
    const policy = activePolicy({
        subjectType: "UNIT",
        subjectUnitId: "unit-1",
        scope: "UNIT_AND_DESCENDANTS",
    });
    assert.equal(policyMatchesUser(policy, user, hierarchy), true);

    const unrelated = activePolicy({
        subjectType: "UNIT",
        subjectUnitId: "unit-9",
        scope: "UNIT_AND_DESCENDANTS",
    });
    assert.equal(policyMatchesUser(unrelated, user, hierarchy), false);

    const noScope = activePolicy({
        subjectType: "UNIT",
        subjectUnitId: "unit-1",
        scope: null,
    });
    assert.equal(policyMatchesUser(noScope, user, hierarchy), false);
});

test("inactive and expired policies never match", () => {
    const inactive = activePolicy({
        isActive: false,
        subjectType: "USER",
        subjectUserId: "user-1",
    });
    assert.equal(
        evaluatePolicyMatches([inactive], user, hierarchy).length,
        0
    );

    const notYetValid = activePolicy({
        validFrom: new Date(Date.now() + 60_000),
        subjectType: "USER",
        subjectUserId: "user-1",
    });
    assert.equal(
        evaluatePolicyMatches([notYetValid], user, hierarchy).length,
        0
    );

    const expired = activePolicy({
        validUntil: new Date(Date.now() - 60_000),
        subjectType: "USER",
        subjectUserId: "user-1",
    });
    assert.equal(
        evaluatePolicyMatches([expired], user, hierarchy).length,
        0
    );

    const validUntilInclusive = activePolicy({
        validUntil: new Date(Date.now() + 60_000),
        subjectType: "USER",
        subjectUserId: "user-1",
    });
    assert.equal(
        evaluatePolicyMatches([validUntilInclusive], user, hierarchy).length,
        1
    );
});

test("DENY always wins over ALLOW", () => {
    const allow = activePolicy({
        subjectType: "USER",
        subjectUserId: "user-1",
        effect: "ALLOW",
    });
    const deny = activePolicy({
        subjectType: "ORGANIZATION",
        subjectOrganizationId: "org-1",
        effect: "DENY",
    });

    const matches = evaluatePolicyMatches(
        [allow, deny],
        user,
        hierarchy
    );
    assert.equal(resolvePolicyDecision(matches), "denied");
});

test("an ALLOW with no DENY grants access", () => {
    const allow = activePolicy({
        subjectType: "USER",
        subjectUserId: "user-1",
        effect: "ALLOW",
    });
    const matches = evaluatePolicyMatches([allow], user, hierarchy);
    assert.equal(resolvePolicyDecision(matches), "allowed");
});

test("an empty match set is a denial", () => {
    assert.equal(resolvePolicyDecision([]), "denied");

    const nonMatching = activePolicy({
        subjectType: "USER",
        subjectUserId: "user-2",
        effect: "ALLOW",
    });
    const matches = evaluatePolicyMatches(
        [nonMatching],
        user,
        hierarchy
    );
    assert.equal(resolvePolicyDecision(matches), "denied");
});

test("a DENY alone denies access", () => {
    const deny = activePolicy({
        subjectType: "ROLE",
        subjectRole: "MEMBER",
        effect: "DENY",
    });
    const matches = evaluatePolicyMatches([deny], user, hierarchy);
    assert.equal(resolvePolicyDecision(matches), "denied");
});

test("unknown subject types never match", () => {
    const policy = activePolicy({
        subjectType: "EVERYONE",
    });
    assert.equal(policyMatchesUser(policy, user, hierarchy), false);
});
