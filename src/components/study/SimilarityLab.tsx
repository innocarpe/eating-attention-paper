import { useMemo, useState } from "preact/hooks";

function dot(a: number[], b: number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]!;
}

function norm(a: number[]): number {
  return Math.hypot(a[0]!, a[1]!);
}

export default function SimilarityLab() {
  const [x, setX] = useState(1);
  const [y, setY] = useState(0.2);
  const anchor = [1, 0];

  const { score, cosine } = useMemo(() => {
    const vector = [x, y];
    const scoreValue = dot(anchor, vector);
    const cosineValue = scoreValue / (norm(anchor) * norm(vector) || 1);
    return { score: scoreValue, cosine: cosineValue };
  }, [x, y]);

  return (
    <section class="study-lab" aria-labelledby="similarity-lab-title">
      <h3 id="similarity-lab-title">직접 조작: 벡터 유사도</h3>
      <p>
        기준 벡터 <code>[1, 0]</code>과 당신 벡터의 내적·코사인 유사도를 봅니다. Attention 점수도 결국
        이런 유사도에서 출발합니다.
      </p>
      <div class="study-lab__controls">
        <label>
          x
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={x}
            onInput={(event) => setX(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <span>{x.toFixed(1)}</span>
        </label>
        <label>
          y
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={y}
            onInput={(event) => setY(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <span>{y.toFixed(1)}</span>
        </label>
      </div>
      <ul>
        <li>내적(dot product): <strong>{score.toFixed(2)}</strong></li>
        <li>코사인 유사도: <strong>{cosine.toFixed(2)}</strong></li>
      </ul>
      <p class="study-lab__note">x를 키우고 y를 0에 가깝게 두면 기준 벡터와 더 비슷해집니다.</p>
    </section>
  );
}
