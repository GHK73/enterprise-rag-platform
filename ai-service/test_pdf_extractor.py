from pathlib import Path

from app.services.extractors.pdf import PDFExtractor


pdf_path = Path("test_files/sample.pdf")

extractor = PDFExtractor()

document = extractor.extract(pdf_path)

print("\n========== DOCUMENT ==========")

print("Filename:", document.metadata.filename)
print("Type:", document.metadata.document_type)
print("Pages:", document.metadata.page_count)

for page in document.pages:
    print(f"\n========== PAGE {page.page_number} ==========")

    print("Number of blocks:", len(page.blocks))

    for block in page.blocks:
        print("\nBlock ID:", block.block_id)
        print("Block Type:", block.block_type)

        if hasattr(block, "text"):
            print("Text:", block.text[:200])

        if hasattr(block, "headers"):
            print("Headers:", block.headers)
            print("Rows:", block.rows)

        print("Metadata:", block.metadata)