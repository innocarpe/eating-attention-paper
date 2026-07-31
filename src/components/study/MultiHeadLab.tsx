import { useMemo, useState } from "preact/hooks";

type HeadFocus = "pronoun" | "syntax" | "position";

const TOKENS = ["The", "animal", "was", "tired", "so", "it", "rested"];

const HEAD_WEIGHTS: Record<HeadFocus, number[][]> = {
  // rows = query token "it" (index 5) attention over keys
  pronoun: [
    [0.05, 0.55, 0.05, 0.1, 0.05, 0.15, 0.05],
  ],
  syntax: [
    [0.05, 0.1, 0.15, 0.1, 0.2, 0.1, 0.3],
  ],
  position: [
    [0.02, 0.03, 0.05, 0.1, 0.2, 0.4, 0.2],
  ],
};

const LABELS: Record<HeadFocus, string> = {
  pronoun: "Head A · 대명사 연결 (it → animal)",
  syntax: "Head B · 절 구조 (so/rested 쪽)",
  position: "Head C · 가까운 위치 선호",
};

export default function MultiHeadLab() {
  const [focus, setFocus] = useState<HeadFocus>("pronoun");
  const weights = useMemo(() => HEAD_WEIGHTS[focus][0]!, [focus]);

  return (
    <section class="study-lab" aria-labelledby="multihead-lab-title">
      <h3 id="multihead-lab-title">직접 비교: Multi-Head는 ‘시선’이 여러 개</h3>
      <p>
        같은 문장, 같은 질의 토큰 <strong>it</strong> 인데 head마다 어디에 주목하는지가 달라질 수
        있습니다. 아래 토글을 바꿔 보세요.
      </p>
      <p class="study-lab__sentence" aria-label="예문">
        The animal was tired so <mark>it</mark> rested.
      </p>
      <div class="study-lab__controls head-toggle" role="radiogroup" aria-label="head 선택">
        {(Object.keys(LABELS) as HeadFocus[]).map((key) => (
          <label key={key}>
            <input
              type="radio"
              name="head-focus"
              checked={focus === key}
              onChange={() => setFocus(key)}
            />
            <span>{LABELS[key]}</span>
          </label>
        ))}
      </div>
      <table class="study-table">
        <thead>
          <tr>
            <th scope="col">Key 토큰</th>
            <th scope="col">이 head의 가중치</th>
          </tr>
        </thead>
        <tbody>
          {TOKENS.map((token, index) => (
            <tr key={`${token}-${index}`} class={index === 5 ? "is-query" : undefined}>
              <td>
                {token}
                {index === 5 ? " ← query" : ""}
              </td>
              <td>
                <div class="weight-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, weights[index]! * 100)}%` }} />
                </div>
                {(weights[index]! * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="study-lab__note">
        핵심: head를 여러 개 두는 이유는 “복붙”이 아니라, 서로 다른 관계 패턴을 병렬로 보기
        위해서입니다. 실제 모델의 head 해석은 더 지저분하지만, 직관은 이것으로 충분합니다.
      </p>
    </section>
  );
}
