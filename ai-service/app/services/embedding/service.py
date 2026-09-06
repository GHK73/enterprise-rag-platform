# ai-service/app/services/embedding/service.py

from __future__ import annotations
import logging
from dataclasses import dataclass
import torch
from sentence_transformers import SentenceTransformer
from app.services.processing.chunking import Chunk

logger = logging.getLogger(__name__)


@dataclass
class EmbeddedChunk:
    chunk: Chunk
    embedding: list[float]


class EmbeddingService:
    """
    Responsible for converting document chunks into vector embeddings.

    The service is intentionally independent of Qdrant.

    Pipeline:

        Chunk
          ↓
        text
          ↓
        SentenceTransformer
          ↓
        embedding vector
          ↓
        EmbeddedChunk
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        batch_size: int = 32,
        device: str | None = None,
    ) -> None:

        if batch_size <= 0:
            raise ValueError(
                "batch_size must be greater than 0."
            )

        self.model_name = model_name
        self.batch_size = batch_size

        self.device = self._resolve_device(device)

        logger.info(
            "Loading embedding model: model=%s device=%s",
            self.model_name,
            self.device,
        )

        self.model = SentenceTransformer(
            self.model_name,
            device=self.device,
        )

        self.dimension = self.model.get_sentence_embedding_dimension()

        logger.info(
            "Embedding model loaded: model=%s dimension=%s device=%s",
            self.model_name,
            self.dimension,
            self.device,
        )

    def _resolve_device(
        self,
        device: str | None,
    ) -> str:

        if device:
            return device

        if torch.cuda.is_available():
            return "cuda"

        return "cpu"

    def embed_texts(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Generate embeddings for a list of texts.

        Embeddings are generated in batches to avoid unnecessarily
        large memory usage.
        """

        if not texts:
            return []

        cleaned_texts = [
            text.strip()
            for text in texts
        ]

        if any(not text for text in cleaned_texts):
            raise ValueError(
                "Embedding input cannot contain empty text."
            )

        logger.info(
            "Generating embeddings: texts=%d batch_size=%d",
            len(cleaned_texts),
            self.batch_size,
        )

        embeddings = self.model.encode(
            cleaned_texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        result = embeddings.tolist()

        logger.info(
            "Embedding generation completed: count=%d dimension=%d",
            len(result),
            self.dimension,
        )

        return result

    def embed_chunks(
        self,
        chunks: list[Chunk],
    ) -> list[EmbeddedChunk]:
        """
        Generate embeddings for document chunks while preserving
        the original Chunk objects and their metadata.
        """

        if not chunks:
            return []

        texts = [
            chunk.text
            for chunk in chunks
        ]

        embeddings = self.embed_texts(texts)

        if len(chunks) != len(embeddings):
            raise RuntimeError(
                "Embedding count does not match chunk count."
            )

        embedded_chunks: list[EmbeddedChunk] = []

        for chunk, embedding in zip(
            chunks,
            embeddings,
        ):
            embedded_chunks.append(
                EmbeddedChunk(
                    chunk=chunk,
                    embedding=embedding,
                )
            )

        return embedded_chunks

    def embed_chunk(
        self,
        chunk: Chunk,
    ) -> EmbeddedChunk:
        """
        Generate an embedding for a single chunk.
        """

        embeddings = self.embed_texts(
            [chunk.text]
        )

        return EmbeddedChunk(
            chunk=chunk,
            embedding=embeddings[0],
        )


embedding_service = EmbeddingService()