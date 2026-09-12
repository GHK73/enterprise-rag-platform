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
    Convert document chunks into vector embeddings.
    The service is independent of Qdrant.
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
        if not model_name.strip():
            raise ValueError(
                "model_name cannot be empty."
            )

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

        dimension = self.model.get_sentence_embedding_dimension()

        if dimension is None or dimension <= 0:
            raise RuntimeError(
                "Embedding model returned an invalid dimension."
            )

        self.dimension = dimension

        logger.info(
            "Embedding model loaded: model=%s dimension=%d device=%s",
            self.model_name,
            self.dimension,
            self.device,
        )

    def _resolve_device(
        self,
        device: str | None,
    ) -> str:
        if device:
            if device == "cuda" and not torch.cuda.is_available():
                raise RuntimeError(
                    "CUDA was explicitly requested but is not available."
                )

            return device

        if torch.cuda.is_available():
            return "cuda"

        return "cpu"

    def embed_texts(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Generate normalized embeddings for a list of texts.

        Embeddings are generated in batches to control memory usage.
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

        if len(result) != len(cleaned_texts):
            raise RuntimeError(
                "Embedding count does not match input text count."
            )

        for index, embedding in enumerate(result):
            if len(embedding) != self.dimension:
                raise RuntimeError(
                    "Embedding dimension mismatch at index "
                    f"{index}: expected {self.dimension}, "
                    f"got {len(embedding)}."
                )

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

        embeddings = self.embed_texts(
            [chunk.text for chunk in chunks]
        )

        if len(chunks) != len(embeddings):
            raise RuntimeError(
                "Embedding count does not match chunk count."
            )

        return [
            EmbeddedChunk(
                chunk=chunk,
                embedding=embedding,
            )
            for chunk, embedding in zip(
                chunks,
                embeddings,
            )
        ]

    def embed_chunk(
        self,
        chunk: Chunk,
    ) -> EmbeddedChunk:
        """
        Generate an embedding for a single chunk.
        """

        if not chunk.text.strip():
            raise ValueError(
                "Cannot embed an empty chunk."
            )

        embeddings = self.embed_texts(
            [chunk.text]
        )

        return EmbeddedChunk(
            chunk=chunk,
            embedding=embeddings[0],
        )


embedding_service = EmbeddingService()