import asyncio
import logging

from app.services.embedding import embedding_service
from app.services.processing.chunking import Chunk
from app.services.vectorstore import qdrant_vector_store


logging.basicConfig(
    level=logging.INFO,
)


DOCUMENT_ID = "test-document-phase7"
VERSION_ID = "test-version-phase7"


def create_test_chunks() -> list[Chunk]:
    return [
        Chunk(
            chunk_id="chunk_000000",
            page_number=1,
            text=(
                "Enterprise RAG systems retrieve authorized "
                "organizational knowledge."
            ),
            block_ids=["block_000000"],
            metadata={
                "chunk_index": 0,
                "page_number": 1,
                "test": True,
            },
        ),
        Chunk(
            chunk_id="chunk_000001",
            page_number=1,
            text=(
                "Permission-aware retrieval prevents "
                "unauthorized information from reaching the LLM."
            ),
            block_ids=["block_000001"],
            metadata={
                "chunk_index": 1,
                "page_number": 1,
                "test": True,
            },
        ),
    ]


async def main() -> None:

    try:
        # 1. Ensure collection exists
        await qdrant_vector_store.ensure_collection()

        print("\nQdrant connection successful.")
        print(
            f"Collection: "
            f"{qdrant_vector_store.collection_name}"
        )
        print(
            f"Vector size: "
            f"{qdrant_vector_store.vector_size}"
        )

        # 2. Create deterministic test chunks
        chunks = create_test_chunks()

        print(
            f"\nCreated test chunks: {len(chunks)}"
        )

        # 3. Generate real embeddings
        embedded_chunks = (
            embedding_service.embed_chunks(chunks)
        )

        print(
            f"Generated embeddings: "
            f"{len(embedded_chunks)}"
        )

        # 4. Index chunks
        await qdrant_vector_store.upsert_chunks(
            document_id=DOCUMENT_ID,
            version_id=VERSION_ID,
            embedded_chunks=embedded_chunks,
        )

        print("\nChunks successfully indexed.")

        # 5. Read indexed points back
        indexed_chunks = (
            await qdrant_vector_store.get_version_points(
                document_id=DOCUMENT_ID,
                version_id=VERSION_ID,
            )
        )

        print(
            f"Retrieved indexed points: "
            f"{len(indexed_chunks)}"
        )

        # 6. Verify point count
        if len(indexed_chunks) != len(chunks):
            raise RuntimeError(
                "Indexed point count does not match "
                "the number of test chunks."
            )

        # 7. Verify payload
        indexed_by_chunk_id = {
            chunk["chunk_id"]: chunk
            for chunk in indexed_chunks
        }

        for original_chunk in chunks:

            indexed_chunk = indexed_by_chunk_id.get(
                original_chunk.chunk_id
            )

            if indexed_chunk is None:
                raise RuntimeError(
                    f"Missing indexed chunk: "
                    f"{original_chunk.chunk_id}"
                )

            if (
                indexed_chunk["document_id"]
                != DOCUMENT_ID
            ):
                raise RuntimeError(
                    "Document ID mismatch."
                )

            if (
                indexed_chunk["version_id"]
                != VERSION_ID
            ):
                raise RuntimeError(
                    "Version ID mismatch."
                )

            if (
                indexed_chunk["text"]
                != original_chunk.text
            ):
                raise RuntimeError(
                    f"Text payload mismatch for "
                    f"{original_chunk.chunk_id}"
                )

        print(
            "Payload verification successful."
        )

        # 8. Search using the first chunk's embedding
        query_vector = embedded_chunks[0].embedding

        results = await qdrant_vector_store.search(
            query_vector=query_vector,
            limit=5,
        )

        print(
            f"\nVector search returned: "
            f"{len(results)} results"
        )

        if not results:
            raise RuntimeError(
                "Vector search returned no results."
            )

        # 9. Verify the indexed test chunk appears
        result_chunk_ids = {
            result["chunk_id"]
            for result in results
        }

        if "chunk_000000" not in result_chunk_ids:
            raise RuntimeError(
                "Expected test chunk was not returned "
                "by vector search."
            )

        print(
            "Vector search verification successful."
        )

        # 10. Verify deterministic point ID
        point_id_1 = (
            qdrant_vector_store._create_point_id(
                document_id=DOCUMENT_ID,
                version_id=VERSION_ID,
                chunk_id="chunk_000000",
            )
        )

        point_id_2 = (
            qdrant_vector_store._create_point_id(
                document_id=DOCUMENT_ID,
                version_id=VERSION_ID,
                chunk_id="chunk_000000",
            )
        )

        if point_id_1 != point_id_2:
            raise RuntimeError(
                "Deterministic point ID verification failed."
            )

        print(
            "Deterministic point ID verification successful."
        )

        # 11. Delete test version
        await qdrant_vector_store.delete_version(
            document_id=DOCUMENT_ID,
            version_id=VERSION_ID,
        )

        print(
            "\nTest version deleted."
        )

        # 12. Verify deletion
        remaining_chunks = (
            await qdrant_vector_store.get_version_points(
                document_id=DOCUMENT_ID,
                version_id=VERSION_ID,
            )
        )

        if remaining_chunks:
            raise RuntimeError(
                "Qdrant version deletion verification failed."
            )

        print(
            "Version deletion verification successful."
        )

        print(
            "\n========================================"
        )
        print(
            "QDRANT PHASE 7 VERIFICATION PASSED"
        )
        print(
            "========================================"
        )

    except Exception as error:

        print(
            "\n========================================"
        )
        print(
            "QDRANT PHASE 7 VERIFICATION FAILED"
        )
        print(
            "========================================"
        )
        print(
            f"Error: {error}"
        )

        raise

    finally:
        await qdrant_vector_store.close()


if __name__ == "__main__":
    asyncio.run(main())