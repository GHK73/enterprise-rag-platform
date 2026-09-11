import asyncio

from app.services.vectorstore import qdrant_vector_store


async def main():

    try:
        # 1. Verify connection
        await qdrant_vector_store.ensure_collection()

        print("Successfully connected to Qdrant Cloud.")
        print(
            f"Collection: "
            f"{qdrant_vector_store.collection_name}"
        )
        print(
            f"Vector size: "
            f"{qdrant_vector_store.vector_size}"
        )

    except Exception as e:

        print("Qdrant connection failed.")
        print(f"Error: {e}")

    finally:
        await qdrant_vector_store.close()


if __name__ == "__main__":
    asyncio.run(main())