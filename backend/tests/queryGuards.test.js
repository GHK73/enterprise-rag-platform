import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateGeneratedAnswer as validateCitations } from "../src/services/query/answerValidation.service.js";
import { validateGeneratedAnswer as validateOutputGuard } from "../src/services/query/outputGuardrail.service.js";
import { generateQueryAnswer } from "../src/services/query/answer.service.js";

test("citation validation accepts in-range citations", () => {
    const sources = [{ index: 1 }, { index: 2 }];
    const result = validateCitations(
        "Revenue is 4.2 million [Source 1] and rising [Source 2].",
        sources
    );

    assert.equal(result.valid, true);
    assert.equal(result.reason, "VALID_RESPONSE");
    assert.equal(
        result.answer,
        "Revenue is 4.2 million [Source 1] and rising [Source 2]."
    );
});

test("citation validation rejects citations to sources that were not supplied", () => {
    /*
     * The LLM must not introduce references to
     * documents or chunks that are not part of
     * the authorized evidence.
     */
    const sources = [{ index: 1 }];
    const result = validateCitations(
        "Revenue is 4.2 million [Source 3].",
        sources
    );

    assert.equal(result.valid, false);
    assert.equal(result.reason, "INVALID_SOURCE_CITATION");
    assert.equal(result.answer, null);
});

test("citation validation rejects an empty answer", () => {
    const result = validateCitations("   ", []);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "EMPTY_LLM_RESPONSE");
});

test("output guardrail passes a safe answer", () => {
    const result = validateOutputGuard("Revenue is 4.2 million.");
    assert.equal(result.safe, true);
    assert.equal(result.answer, "Revenue is 4.2 million.");
});

test("output guardrail blocks prompt-extraction attempts", () => {
    const result = validateOutputGuard(
        "Here is the system prompt: ..."
    );
    assert.equal(result.safe, false);
    assert.equal(
        result.answer,
        "I could not provide that information."
    );
});

test("output guardrail blocks chain-of-thought disclosure", () => {
    const result = validateOutputGuard(
        "My chain of thought was to check the files."
    );
    assert.equal(result.safe, false);
});

test("output guardrail replaces an empty answer", () => {
    const result = validateOutputGuard("");
    assert.equal(result.safe, false);
    assert.equal(
        result.answer,
        "I could not generate a reliable answer from the provided documents."
    );
});

test("answer service returns the evidence fallback without invoking the LLM", async () => {
    /*
     * The insufficient-evidence branch returns
     * before generateAnswer is called, so this
     * exercises the real answer service with no
     * LLM infrastructure.
     */
    const result = await generateQueryAnswer({
        evidence: { sufficient: false, reason: "NO_AUTHORIZED_EVIDENCE" },
        prompt: "irrelevant",
        sources: [],
    });

    assert.equal(result.usedLLM, false);
    assert.equal(
        result.answer,
        "I couldn't find sufficient information in the authorized documents to answer this question."
    );
});

test("answer service returns a context fallback when the prompt is empty", async () => {
    const result = await generateQueryAnswer({
        evidence: { sufficient: true, reason: "SUFFICIENT_EVIDENCE" },
        prompt: "   ",
        sources: [],
    });

    assert.equal(result.usedLLM, false);
    assert.equal(
        result.answer,
        "I couldn't generate an answer because sufficient context was not available."
    );
});
