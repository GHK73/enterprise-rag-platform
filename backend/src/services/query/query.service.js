import { retrieveFromAI } from "./queryAI.service.js";
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

const saveQueryHistory = async ({
    user,
    query,
    answer,
    sources,
    evidence,
    usedLLM,
    outputGuardPassed,
}) => {
    const organizationId = user?.unit?.organizationId;

    if (!organizationId || !user?.id) {
        throw new Error(
            "Query history requires an authenticated organization user."
        );
    }

    await prisma.queryHistory.create({
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
    candidates
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

    const documents = await prisma.document.findMany({
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
    candidates
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

export const retrieveAuthorizedCandidates = async (
    user,
    query,
    topK = 5
) => {
    const organizationId = user?.unit?.organizationId;

    if (!organizationId) {
        throw new Error(
            "User organization could not be determined."
        );
    }

    const cachedCandidates = await getCachedQuery(
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
        retrievalResponse = await retrieveFromAI(
            query,
            topK,
            organizationId
        );

        candidates = retrievalResponse.results || [];

        await setCachedQuery(
            organizationId,
            query,
            topK,
            candidates
        );
    }

    const accessScopeHash =
        await getQueryAccessScopeFingerprint(user);

    let authorizedCandidates = null;

    if (rawCacheHit) {
        authorizedCandidates =
            await getCachedAuthorizedQuery(
                organizationId,
                accessScopeHash,
                query,
                topK
            );

        if (Array.isArray(authorizedCandidates)) {
            authorizedCandidates =
                await validateCurrentCandidates(
                    organizationId,
                    authorizedCandidates
                );
        }
    }

    if (!Array.isArray(authorizedCandidates)) {
        authorizedCandidates =
            await authorizeCandidates(
                user,
                candidates
            );

        await setCachedAuthorizedQuery(
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

    const evidence = checkEvidenceSufficiency(
        rerankedCandidates
    );

    if (!evidence.sufficient) {
        const answer =
            "I couldn't find sufficient information in the authorized documents to answer this question.";

        await saveQueryHistory({
            user,
            query: retrievalResponse.query,
            answer,
            sources: [],
            evidence,
            usedLLM: false,
            outputGuardPassed: false,
        });

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
    } = buildSafeContext(
        rerankedCandidates
    );

    const prompt = buildRAGPrompt(
        retrievalResponse.query,
        context
    );

    const answerResult = await generateQueryAnswer({
        evidence,
        prompt,
        sources,
    });

    const guardedAnswer = validateOutputGuard(
        answerResult.answer
    );

    await saveQueryHistory({
        user,
        query: retrievalResponse.query,
        answer: guardedAnswer.answer,
        sources,
        evidence,
        usedLLM: answerResult.usedLLM,
        outputGuardPassed: guardedAnswer.safe,
    });

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