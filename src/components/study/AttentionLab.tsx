import { useMemo, useState } from "preact/hooks";

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0);
  return exps.map((value) => value / sum);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index]!, 0);
}

const KEYS = [
  { label: "토큰1: cat", key: [1, 0], value: [1, 0] },
  { label: "토큰2: sat", key: [0.2, 1], value: [0, 1] },
  { label: "토큰3: mat", key: [0.9, 0.1], value: [0.5, 0.5] },
];

export default function AttentionLab() {
  const [q0, setQ0] = useState(1);
  const [q1, setQ1] = useState(0);
  const scale = Math.SQRT2;

  const result = useMemo(() => {
    const query = [q0, q1];
    const scores = KEYS.map((item) => dot(query, item.key));
    const scaled = scores.map((score) => score / scale);
    const weights = softmax(scaled);
    const output = [
      weights.reduce((sum, weight, index) => sum + weight * KEYS[index]!.value[0]!, 0),
      weights.reduce((sum, weight, index) => sum + weight * KEYS[index]!.value[1]!, 0),
    ];
    return { scores, scaled, weights, output };
  }, [q0, q1]);

  return (
    <section class="study-lab" aria-labelledby="attention-lab-title">
      <h3 id="attention-lab-title">직접 조작: Scaled Dot-Product</h3>
      <p>
        Query 벡터를 바꾸면 각 토큰 가중치가 어떻게 달라지는지 보세요. 수식은{" "}
        <code>softmax(QKᵀ/√d_k)V</code> 입니다.
      </p>

      <div class="study-lab__controls">
        <label>
          Query[0]
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={q0}
            onInput={(event) => setQ0(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <span>{q0.toFixed(1)}</span>
        </label>
        <label>
          Query[1]
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={q1}
            onInput={(event) => setQ1(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <span>{q1.toFixed(1)}</span>
        </label>
      </div>

      <table class="study-table">
        <thead>
          <tr>
            <th scope="col">토큰</th>
            <th scope="col">내적 점수</th>
            <th scope="col">스케일 후</th>
            <th scope="col">Softmax 가중치</th>
          </tr>
        </thead>
        <tbody>
          {KEYS.map((item, index) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{result.scores[index]!.toFixed(2)}</td>
              <td>{result.scaled[index]!.toFixed(2)}</td>
              <td>
                <div class="weight-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, result.weights[index]! * 100)}%` }} />
                </div>
                {(result.weights[index]! * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        가중합 출력 ≈ [{result.output[0]!.toFixed(2)}, {result.output[1]!.toFixed(2)}]
      </p>
      <p class="study-lab__note">
        팁: Query를 cat의 key 방향 [1, 0]에 가깝게 두면 토큰1 가중치가 커집니다.
      </p>
    </section>
  );
}
