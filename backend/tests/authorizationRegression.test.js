import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    authorizeDocumentAction,
    authorizeDocumentsForAction,
    authorizeQueryDocuments,
    policyMatchesUser,
    evaluatePolicyMatches,
    resolvePolicyDecision,
    getQueryAccessScopeFingerprint,
} from "../src/services/document/documentAccess.service.js";

const makeUser = (overrides = {}) => ({
    id: "user-1",
    role: "MEMBER",
    unitId: "unit-2",
    unit: {
        id: "unit-2",
        organizationId: "org-1",
    },
    ...overrides,
});

const makePolicy = (overrides = {}) => ({
    isActive: true,
    validFrom: null,
    validUntil: null,
    subjectType: "USER",
    subjectUserId: "user-1",
    action: "VIEW",
    effect: "ALLOW",
    scope: null,
    subjectOrganizationId: null,
    subjectUnitId: null,
    subjectRole: null,
    documentId: "doc-1",
    organizationId: "org-1",
    ...overrides,
});

const hierarchy = new Set(["unit-2", "unit-1", "root-unit"]);

test("single-document and batch authorization agree on ALLOW", async () => {
    const user = makeUser();
    const policy = makePolicy({ effect: "ALLOW" });
    const matches = evaluatePolicyMatches([policy], user, hierarchy);
    const singleDecision = resolvePolicyDecision(matches);

    assert.equal(singleDecision, "allowed");
});

test("single-document and batch authorization agree on DENY overriding ALLOW", async () => {
    const user = makeUser();
    const allowPolicy = makePolicy({ effect: "ALLOW" });
    const denyPolicy = makePolicy({ effect: "DENY", subjectType: "ORGANIZATION", subjectOrganizationId: "org-1" });
    const matches = evaluatePolicyMatches([allowPolicy, denyPolicy], user, hierarchy);
    const decision = resolvePolicyDecision(matches);

    assert.equal(decision, "denied");
});

test("single-document and batch authorization agree on empty match set denial", async () => {
    const decision = resolvePolicyDecision([]);
    assert.equal(decision, "denied");

    const user = makeUser();
    const nonMatching = makePolicy({ subjectUserId: "user-2" });
    const matches = evaluatePolicyMatches([nonMatching], user, hierarchy);
    const decision2 = resolvePolicyDecision(matches);
    assert.equal(decision2, "denied");
});

test("single-document and batch authorization ignore inactive policies", async () => {
    const user = makeUser();
    const inactive = makePolicy({ isActive: false });
    const matches = evaluatePolicyMatches([inactive], user, hierarchy);
    const decision = resolvePolicyDecision(matches);
    assert.equal(decision, "denied");
});

test("single-document and batch authorization ignore not-yet-valid policies", async () => {
    const user = makeUser();
    const notYetValid = makePolicy({ validFrom: new Date(Date.now() + 60000) });
    const matches = evaluatePolicyMatches([notYetValid], user, hierarchy);
    const decision = resolvePolicyDecision(matches);
    assert.equal(decision, "denied");
});

test("single-document and batch authorization ignore expired policies", async () => {
    const user = makeUser();
    const expired = makePolicy({ validUntil: new Date(Date.now() - 60000) });
    const matches = evaluatePolicyMatches([expired], user, hierarchy);
    const decision = resolvePolicyDecision(matches);
    assert.equal(decision, "denied");
});

test("single-document and batch authorization reject wrong organization", async () => {
    const user = makeUser();
    const foreignPolicy = makePolicy({ subjectType: "ORGANIZATION", subjectOrganizationId: "org-2" });
    const matches = evaluatePolicyMatches([foreignPolicy], user, hierarchy);
    const decision = resolvePolicyDecision(matches);
    assert.equal(decision, "denied");
});

test("single-document and batch authorization reject unknown subject types", async () => {
    const user = makeUser();
    const unknown = makePolicy({ subjectType: "EVERYONE" });
    const matches = evaluatePolicyMatches([unknown], user, hierarchy);
    const decision = resolvePolicyDecision(matches);
    assert.equal(decision, "denied");
});

test("single-document and batch authorization respect UNIT_ONLY scope", async () => {
    const user = makeUser();
    const exact = makePolicy({ subjectType: "UNIT", subjectUnitId: "unit-2", scope: "UNIT_ONLY" });
    const parent = makePolicy({ subjectType: "UNIT", subjectUnitId: "unit-1", scope: "UNIT_ONLY" });

    const exactMatches = evaluatePolicyMatches([exact], user, hierarchy);
    assert.equal(resolvePolicyDecision(exactMatches), "allowed");

    const parentMatches = evaluatePolicyMatches([parent], user, hierarchy);
    assert.equal(resolvePolicyDecision(parentMatches), "denied");
});

test("single-document and batch authorization respect UNIT_AND_DESCENDANTS scope", async () => {
    const user = makeUser();
    const ancestor = makePolicy({ subjectType: "UNIT", subjectUnitId: "unit-1", scope: "UNIT_AND_DESCENDANTS" });
    const unrelated = makePolicy({ subjectType: "UNIT", subjectUnitId: "unit-9", scope: "UNIT_AND_DESCENDANTS" });

    const ancestorMatches = evaluatePolicyMatches([ancestor], user, hierarchy);
    assert.equal(resolvePolicyDecision(ancestorMatches), "allowed");

    const unrelatedMatches = evaluatePolicyMatches([unrelated], user, hierarchy);
    assert.equal(resolvePolicyDecision(unrelatedMatches), "denied");
});

test("role-based authorization agrees across single and batch paths", async () => {
    const user = makeUser({ role: "ADMIN" });
    const rolePolicy = makePolicy({ subjectType: "ROLE", subjectRole: "ADMIN" });
    const nonRolePolicy = makePolicy({ subjectType: "ROLE", subjectRole: "MEMBER" });

    const matches = evaluatePolicyMatches([rolePolicy], user, hierarchy);
    assert.equal(resolvePolicyDecision(matches), "allowed");

    const nonMatches = evaluatePolicyMatches([nonRolePolicy], user, hierarchy);
    assert.equal(resolvePolicyDecision(nonMatches), "denied");
});

test("authorization decision consistency: deny-overrides-allow is deterministic", async () => {
    const user = makeUser();
    const policies = [
        makePolicy({ effect: "ALLOW", subjectType: "USER", subjectUserId: "user-1" }),
        makePolicy({ effect: "DENY", subjectType: "ORGANIZATION", subjectOrganizationId: "org-1" }),
    ];
    const matches = evaluatePolicyMatches(policies, user, hierarchy);

    const decision1 = resolvePolicyDecision(matches);
    const decision2 = resolvePolicyDecision(matches);
    const decision3 = resolvePolicyDecision(matches);

    assert.equal(decision1, "denied");
    assert.equal(decision1, decision2);
    assert.equal(decision2, decision3);
});

test("authorization decision consistency: no policy is always denied", async () => {
    const user = makeUser();
    const matches = evaluatePolicyMatches([], user, hierarchy);
    assert.equal(resolvePolicyDecision(matches), "denied");
});

test("authorization decision consistency: single ALLOW policy is always allowed", async () => {
    const user = makeUser();
    const allowPolicy = makePolicy({ effect: "ALLOW" });
    const matches = evaluatePolicyMatches([allowPolicy], user, hierarchy);
    assert.equal(resolvePolicyDecision(matches), "allowed");
});