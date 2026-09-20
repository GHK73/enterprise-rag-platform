// backend/src/services/query/query.service.js
import { retrieveFromAI } from "./queryAI.service.js";
import { rerankCandidates } from "./reranking.service.js";
import { authorizeQueryDocuments } from "../document/documentAccess.service.js";
import { buildSafeContext } from "./contextGuard.service.js";
import { buildRAGPrompt } from "./prompt.service.js";
import { getCachedQuery, setCachedQuery } from "./queryCache.service.js";
import { checkEvidenceSufficiency } from "./evidence.service.js";
import { generateQueryAnswer } from "./answer.service.js";
import { validateGeneratedAnswer as validateOutputGuard } from "./outputGuardrail.service.js";

export const retrieveAuthorizedCandidates = async (user, query, topK = 5) => {
    const organizationId = user?.unit?.organizationId;

    if (!organizationId) {
        throw new Error("User organization could not be determined.");
    }

    let retrievalResponse = await getCachedQuery(
        organizationId,
        query,
        topK
    );
    const cacheHit = Boolean(retrievalResponse);

    if (!retrievalResponse) {
        retrievalResponse = await retrieveFromAI(
            query,
            topK,
            organizationId
        );
    }

    const candidates = retrievalResponse.results || [];

    const documentIds = [
        ...new Set(
            candidates
                .map((candidate) => candidate.document_id)
                .filter(Boolean)
        ),
    ];

    const authorizedDocumentIds = await authorizeQueryDocuments(
        user,
        documentIds
    );

    const authorizedIdSet = new Set(authorizedDocumentIds);

    const authorizedCandidates = candidates.filter(
        (candidate) => authorizedIdSet.has(candidate.document_id)
    );

    if (!cacheHit) {
        await setCachedQuery(
            organizationId,
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
        return {
            query: retrievalResponse.query,
            results: [],
            context: "",
            sources: [],
            prompt: null,
            answer: "I couldn't find sufficient information in the authorized documents to answer this question.",
            evidence,
            requiresGeneration: false,
            usedLLM: false,
        };
    }

    const { context, sources } = buildSafeContext(
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