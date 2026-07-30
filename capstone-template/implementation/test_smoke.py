def attention_shape(batch: int, heads: int, seq: int, dim: int) -> tuple[int, int, int, int]:
    # Placeholder smoke contract for learners to replace with a real implementation.
    return (batch, heads, seq, dim)


def test_attention_shape() -> None:
    assert attention_shape(2, 4, 8, 16) == (2, 4, 8, 16)
