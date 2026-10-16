import "./setup.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { saveQueryHistory } from "../src/services/query/query.service.js";
import { getQueryHistory } from "../src/services/query/queryHistory.service.js";

test("query history persistence stores only query and answer with user ownership", async () => {
    const user = {
        id: "user-1",
        unit: {
            organizationId: "org-1",
        },
    };
    let createArgs;
    const prismaClient = {
        queryHistory: {
            create: async (args) => {
                createArgs = args;
            },
        },
    };

    await saveQueryHistory(
        {
            user,
            query: "What is the revenue target?",
            answer: "The target is 4.2 million.",
        },
        prismaClient
    );

    assert.deepEqual(createArgs.data, {
        organizationId: "org-1",
        userId: "user-1",
        query: "What is the revenue target?",
        answer: "The target is 4.2 million.",
    });
});

test("query history is scoped to the authenticated user and organization", async () => {
    const user = {
        id: "user-1",
        unit: {
            organizationId: "org-1",
        },
    };
    let findManyArgs;
    const prismaClient = {
        queryHistory: {
            findMany: async (args) => {
                findManyArgs = args;
                return [];
            },
        },
    };

    const result = await getQueryHistory(user, 10, 20, prismaClient);

    assert.deepEqual(findManyArgs.where, {
        organizationId: "org-1",
        userId: "user-1",
    });
    assert.equal(findManyArgs.take, 11);
    assert.equal(findManyArgs.skip, 20);
    assert.deepEqual(result, {
        history: [],
        hasMore: false,
    });
    assert.deepEqual(findManyArgs.select, {
        id: true,
        query: true,
        answer: true,
        createdAt: true,
    });
    assert.deepEqual(findManyArgs.orderBy, { createdAt: "desc" });
});

test("query history reports more pages without returning the extra row", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
        id: `history-${index}`,
        query: `query-${index}`,
        answer: `answer-${index}`,
        createdAt: new Date(),
    }));
    const prismaClient = {
        queryHistory: {
            findMany: async () => rows,
        },
    };

    const result = await getQueryHistory(
        {
            id: "user-1",
            unit: { organizationId: "org-1" },
        },
        2,
        0,
        prismaClient
    );

    assert.equal(result.history.length, 2);
    assert.equal(result.hasMore, true);
});

test("query history rejects users without an organization", async () => {
    await assert.rejects(
        getQueryHistory(
            { id: "user-1" },
            10,
            0,
            {
                queryHistory: {
                    findMany: async () => [],
                },
            }
        ),
        {
            message: "User organization could not be determined.",
            statusCode: 403,
        }
    );
});
