import logging
from uuid import UUID

from sentence_transformers import SentenceTransformer

from worker.config import settings

logger = logging.getLogger(__name__)
_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
    return _model


def generate_embeddings(segments: list[dict]) -> list[dict]:
    texts = []
    indices = []
    for i, seg in enumerate(segments):
        text = seg.get("asr_text") or ""
        if text.strip():
            texts.append(text)
            indices.append(i)

    if not texts:
        logger.info("No text to embed")
        return []

    model = _get_model()
    vectors = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)

    results = []
    for idx, vec in zip(indices, vectors):
        results.append({
            "segment_id": segments[idx]["id"],
            "embedding": vec.tolist(),
        })

    logger.info("Generated %d embeddings", len(results))
    return results
