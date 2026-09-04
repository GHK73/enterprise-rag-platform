from pathlib import Path

from app.services.processing.extraction import extraction_service
from app.services.processing.normalization import normalization_service
from app.services.processing.chunking import chunking_service


file_path = Path("test_files/sample.pdf")


# 1. Extract
document = extraction_service.extract(file_path)

print("\n========== EXTRACTION ==========")
print("Pages:", len(document.pages))


# 2. Normalize
document = normalization_service.normalize(document)

print("\n========== NORMALIZATION ==========")
print("Normalization completed")


# 3. Chunk
chunks = chunking_service.chunk(document)

print("\n========== CHUNKING ==========")
print("Total chunks:", len(chunks))


for index, chunk in enumerate(chunks, start=1):

    print(f"\n----- CHUNK {index} -----")

    print("Chunk ID:", chunk.chunk_id)
    print("Page:", chunk.page_number)
    print("Block IDs:", chunk.block_ids)
    print("Metadata:", chunk.metadata)

    print("Text:")
    print(chunk.text[:500])