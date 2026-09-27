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

export const retrieveAuthorizedCandidates=async(user,query,topK=5)=>{
    const organizationId=user?.unit?.organizationId;
    if(!organizationId){
        throw new Error("User organization could not be determined.");
    }

    let cachedCandidates=await getCachedQuery(
        organizationId,
        query,
        topK
    );

    let retrievalResponse;
    let candidates;
    let cacheHit=Array.isArray(cachedCandidates);

    if(cacheHit){
        candidates=cachedCandidates;
        retrievalResponse={
            query,
            results:candidates
        };
    }else{
        retrievalResponse=await retrieveFromAI(
            query,
            topK,
            organizationId
        );
        candidates=retrievalResponse.results||[];
    }

    const documentIds=[
        ...new Set(
            candidates
                .map(candidate=>candidate.document_id)
                .filter(Boolean)
        )
    ];

    const authorizedDocuments=await authorizeQueryDocuments(
        user,
        documentIds
    );

    const authorizedVersionMap=new Map(
        authorizedDocuments.map(document=>[
            document.documentId,
            document.currentVersionId
        ])
    );

    const hasStaleCandidates=cacheHit&&candidates.some(candidate=>{
        const currentVersionId=authorizedVersionMap.get(
            candidate.document_id
        );

        return(
            currentVersionId&&
            candidate.version_id!==currentVersionId
        );
    });

    if(hasStaleCandidates){
        retrievalResponse=await retrieveFromAI(
            query,
            topK,
            organizationId
        );
        candidates=retrievalResponse.results||[];
        cacheHit=false;
    }

    const refreshedDocumentIds=[
        ...new Set(
            candidates
                .map(candidate=>candidate.document_id)
                .filter(Boolean)
        )
    ];

    const refreshedAuthorizedDocuments=cacheHit
        ? authorizedDocuments
        : await authorizeQueryDocuments(
            user,
            refreshedDocumentIds
        );

    const refreshedAuthorizedVersionMap=new Map(
        refreshedAuthorizedDocuments.map(document=>[
            document.documentId,
            document.currentVersionId
        ])
    );

    const authorizedCandidates=candidates.filter(candidate=>{
        const currentVersionId=
            refreshedAuthorizedVersionMap.get(
                candidate.document_id
            );

        return(
            currentVersionId&&
            candidate.version_id===currentVersionId
        );
    });

    if(!cacheHit){
        await setCachedQuery(
            organizationId,
            query,
            topK,
            authorizedCandidates
        );
    }

    const rerankedCandidates=rerankCandidates(
        authorizedCandidates,
        topK
    );

    const evidence=checkEvidenceSufficiency(
        rerankedCandidates
    );

    if(!evidence.sufficient){
        return{
            query:retrievalResponse.query,
            results:[],
            context:"",
            sources:[],
            prompt:null,
            answer:"I couldn't find sufficient information in the authorized documents to answer this question.",
            evidence,
            requiresGeneration:false,
            usedLLM:false
        };
    }

    const{context,sources}=buildSafeContext(
        rerankedCandidates
    );

    const prompt=buildRAGPrompt(
        retrievalResponse.query,
        context
    );

    const answerResult=await generateQueryAnswer({
        evidence,
        prompt,
        sources
    });

    const guardedAnswer=validateOutputGuard(
        answerResult.answer
    );

    return{
        query:retrievalResponse.query,
        results:rerankedCandidates,
        context,
        sources,
        prompt:null,
        answer:guardedAnswer.answer,
        evidence,
        requiresGeneration:false,
        usedLLM:answerResult.usedLLM,
        outputGuardPassed:guardedAnswer.safe
    };
};