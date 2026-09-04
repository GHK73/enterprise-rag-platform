import asyncio

from app.schemas.processing import ProcessDocumentRequest
from app.services.processing.service import processing_service


async def main():

    request = ProcessDocumentRequest(
        document_id="test-document-001",
        version_id="test-version-001",
        file_url="http://127.0.0.1:9000/sample.pdf",
    )

    response = await processing_service.process_document(
        request
    )

    print("\n========== PROCESSING RESULT ==========")
    print("Success:", response.success)
    print("Message:", response.message)
    print("Document ID:", response.document_id)
    print("Version ID:", response.version_id)


if __name__ == "__main__":
    asyncio.run(main())