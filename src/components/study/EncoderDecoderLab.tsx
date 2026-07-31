import { useState } from "preact/hooks";

type Stage = "encode" | "decode-self" | "cross" | "predict";

const STAGES: { id: Stage; title: string; detail: string }[] = [
  {
    id: "encode",
    title: "1) Encoder self-attention",
    detail:
      "원문 토큰들이 서로 보고 문맥화된 표현을 만듭니다. 예: 영어 문장 전체를 이해 가능한 벡터 열로 바꿉니다.",
  },
  {
    id: "decode-self",
    title: "2) Decoder masked self-attention",
    detail:
      "이미 생성한 출력만 봅니다. 미래 위치는 마스크로 가려 ‘커닝’을 막습니다.",
  },
  {
    id: "cross",
    title: "3) Cross-attention",
    detail:
      "Decoder 상태가 Encoder 출력(K/V)을 조회합니다. 지금 만들 단어에 필요한 원문 조각을 가져옵니다.",
  },
  {
    id: "predict",
    title: "4) 다음 토큰 예측",
    detail: "모은 표현으로 어휘 분포를 만들고 다음 단어를 선택합니다. 그리고 2)로 돌아가 반복합니다.",
  },
];

export default function EncoderDecoderLab() {
  const [stage, setStage] = useState<Stage>("encode");
  const current = STAGES.find((item) => item.id === stage)!;

  return (
    <section class="study-lab" aria-labelledby="ed-lab-title">
      <h3 id="ed-lab-title">단계 추적: 번역 한 토큰이 나오기까지</h3>
      <p>원문 “I love cats” → 출력 “나는 고양이를 …” 를 만들 때 데이터가 흐르는 순서입니다.</p>
      <div class="ed-flow" role="list">
        <div class={stage === "encode" ? "is-on" : undefined} role="listitem">
          Encoder
          <small>I love cats</small>
        </div>
        <div class="ed-arrow" aria-hidden="true">
          →
        </div>
        <div
          class={stage === "decode-self" || stage === "cross" || stage === "predict" ? "is-on" : undefined}
          role="listitem"
        >
          Decoder
          <small>나는 고양이를 ▯</small>
        </div>
      </div>
      <div class="study-lab__controls head-toggle" role="radiogroup" aria-label="단계 선택">
        {STAGES.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name="ed-stage"
              checked={stage === item.id}
              onChange={() => setStage(item.id)}
            />
            <span>{item.title}</span>
          </label>
        ))}
      </div>
      <p>
        <strong>{current.title}</strong>
      </p>
      <p>{current.detail}</p>
      <p class="study-lab__note">
        시험에 자주 나오는 구분: Encoder self-attention ≠ Decoder cross-attention. 전자는 원문
        내부, 후자는 원문 조회입니다.
      </p>
    </section>
  );
}
