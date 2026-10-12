import { retrieveFromAI as defaultRetrieveFromAI } from "./queryAI.service.js";
import { rerankCandidates } from "./reranking.service.js";
import {
    authorizeQueryDocuments,
    getQueryAccessScopeFingerprint,
} from "../document/documentAccess.service.js";
import { buildSafeContext } from "./contextGuard.service.js";
import { buildRAGPrompt } from "./prompt.service.js";
import {
    getCachedQuery,
    setCachedQuery,
} from "./queryCache.service.js";
import {
    getCachedAuthorizedQuery,
    setCachedAuthorizedQuery,
} from "./queryAccessCache.service.js";
import { checkEvidenceSufficiency } from "./evidence.service.js";
import { generateQueryAnswer } from "./answer.service.js";
import {
    validateGeneratedAnswer as validateOutputGuard,
} from "./outputGuardrail.service.js";
import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

const saveQueryHistory = async ({
    user,
    query,
    answer,
    sources,
    evidence,
    usedLLM,
    outputGuardPassed,
}, prismaClient = prisma) => {
    const organizationId = user?.unit?.organizationId;

    if (!organizationId || !user?.id) {
        throw new ApiError(
            403,
            "Query history requires an authenticated organization user."
        );
    }

    await prismaClient.queryHistory.create({
        data: {
            organizationId,
            userId: user.id,
            query,
            answer,
            sources: sources ?? null,
            evidence: evidence ?? null,
            usedLLM,
            outputGuardPassed,
        },
    });
};

const validateCurrentCandidates = async (
    organizationId,
    candidates,
    prismaClient = prisma
) => {
    if (!candidates?.length) {
        return [];
    }

    const documentIds = [
        ...new Set(
            candidates
                .map((candidate) => candidate.document_id)
                .filter(Boolean)
        ),
    ];

    if (!documentIds.length) {
        return [];
    }

    const documents = await prismaClient.document.findMany({
        where: {
            id: {
                in: documentIds,
            },
            organizationId,
            isDeleted: false,
            status: "READY",
            currentVersionId: {
                not: null,
            },
        },
        select: {
            id: true,
            currentVersionId: true,
        },
    });

    const versionMap = new Map(
        documents.map((document) => [
            document.id,
            document.currentVersionId,
        ])
    );

    return candidates.filter((candidate) => {
        const currentVersionId =
            versionMap.get(candidate.document_id);

        return (
            currentVersionId &&
            candidate.version_id === currentVersionId
        );
    });
};

const authorizeCandidates = async (
    user,
    candidates,
    authorizeQueryDocuments
) => {
    const documentIds = [
        ...new Set(
            candidates
                .map((candidate) => candidate.document_id)
                .filter(Boolean)
        ),
    ];

    if (!documentIds.length) {
        return [];
    }

    const authorizedDocuments =
        await authorizeQueryDocuments(
            user,
            documentIds
        );

    const authorizedVersionMap = new Map(
        authorizedDocuments.map((document) => [
            document.documentId,
            document.currentVersionId,
        ])
    );

    return candidates.filter((candidate) => {
        const currentVersionId =
            authorizedVersionMap.get(
                candidate.document_id
            );

        return (
            currentVersionId &&
            candidate.version_id === currentVersionId
        );
    });
};

/*
 * Pipeline dependencies. Every boundary (AI retrieval,
 * Redis caches, authorization, LLM generation, output
 * guard, history persistence) is injectable so the
 * full pipeline — including the response contract and
 * the insufficient-evidence fallback — can be
 * integration-tested without live infrastructure.
 */
const defaultDependencies = {
    prisma,
    retrieveFromAI: defaultRetrieveFromAI,
    getCachedQuery,
    setCachedQuery,
    getCachedAuthorizedQuery,
    setCachedAuthorizedQuery,
    getQueryAccessScopeFingerprint,
    authorizeQueryDocuments,
    buildSafeContext,
    buildRAGPrompt,
    checkEvidenceSufficiency,
    generateQueryAnswer,
    validateOutputGuard,
    saveQueryHistory,
};

export const retrieveAuthorizedCandidates = async (
    user,
    query,
    topK = 5,
    injectedDependencies = {}
) => {
    const dependencies = {
        ...defaultDependencies,
        ...injectedDependencies,
    };

    const organizationId = user?.unit?.organizationId;

    if (!organizationId) {
        throw new ApiError(
            403,
            "User organization could not be determined."
        );
    }

    const cachedCandidates = await dependencies.getCachedQuery(
        organizationId,
        query,
        topK
    );

    const rawCacheHit = Array.isArray(
        cachedCandidates
    );

    let candidates;
    let retrievalResponse;

    if (rawCacheHit) {
        candidates = cachedCandidates;

        retrievalResponse = {
            query,
            results: candidates,
        };
    } else {
        retrievalResponse = await dependencies.retrieveFromAI(
            query,
            topK,
            organizationId
        );

        candidates = retrievalResponse.results || [];

        await dependencies.setCachedQuery(
            organizationId,
            query,
            topK,
            candidates
        );
    }

    const accessScopeHash =
        await dependencies.getQueryAccessScopeFingerprint(user);

    let authorizedCandidates = null;

    if (rawCacheHit) {
        authorizedCandidates =
            await dependencies.getCachedAuthorizedQuery(
                organizationId,
                accessScopeHash,
                query,
                topK
            );

        if (Array.isArray(authorizedCandidates)) {
            authorizedCandidates =
                await validateCurrentCandidates(
                    organizationId,
                    authorizedCandidates,
                    dependencies.prisma
                );
        }
    }

    if (!Array.isArray(authorizedCandidates)) {
        authorizedCandidates =
            await authorizeCandidates(
                user,
                candidates,
                dependencies.authorizeQueryDocuments
            );

        await dependencies.setCachedAuthorizedQuery(
            organizationId,
            accessScopeHash,
            query,
            topK,
            authorizedCandidates
        );
    }

    const rerankedCandidates = rerankCandidates(
        authorizedCandidates,
        topK
    );

    const evidence = dependencies.checkEvidenceSufficiency(
        rerankedCandidates
    );

    if (!evidence.sufficient) {
        const answer =
            "I couldn't find sufficient information in the authorized documents to answer this question.";

        try {
            await dependencies.saveQueryHistory({
                user,
                query: retrievalResponse.query,
                answer,
                sources: [],
                evidence,
                usedLLM: false,
                outputGuardPassed: false,
            }, dependencies.prisma);
        } catch (historyError) {
            console.error(
                "QUERY HISTORY: failed to save insufficient-evidence record:",
                historyError.message
            );
        }

        return {
            query: retrievalResponse.query,
            results: [],
            context: "",
            sources: [],
            prompt: null,
            answer,
            evidence,
            requiresGeneration: false,
            usedLLM: false,
            outputGuardPassed: false,
        };
    }

    const {
        context,
        sources,
    } = dependencies.buildSafeContext(
        rerankedCandidates
    );

    const prompt = dependencies.buildRAGPrompt(
        retrievalResponse.query,
        context
    );

    const answerResult = await dependencies.generateQueryAnswer({
        evidence,
        prompt,
        sources,
    });

    const guardedAnswer = dependencies.validateOutputGuard(
        answerResult.answer
    );

    try {
        await dependencies.saveQueryHistory({
            user,
            query: retrievalResponse.query,
            answer: guardedAnswer.answer,
            sources,
            evidence,
            usedLLM: answerResult.usedLLM,
            outputGuardPassed: guardedAnswer.safe,
        }, dependencies.prisma);
    } catch (historyError) {
        console.error(
            "QUERY HISTORY: failed to save query record:",
            historyError.message
        );
    }

    return {
        query: retrievalResponse.query,
        results: rerankedCandidates,
        context,
        sources,
        prompt: null,
        answer: guardedAnswer.answer,
        evidence,
        requiresGeneration: false,
        usedLLM: answerResult.usedLLM,
        outputGuardPassed: guardedAnswer.safe,
    };
};
