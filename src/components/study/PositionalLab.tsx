import { useMemo, useState } from "preact/hooks";

function positionalValues(position: number, dims = 8): number[] {
  const values: number[] = [];
  for (let i = 0; i < dims; i += 1) {
    const denom = 10000 ** (Math.floor(i / 2) / (dims / 2));
    values.push(i % 2 === 0 ? Math.sin(position / denom) : Math.cos(position / denom));
  }
  return values;
}

export default function PositionalLab() {
  const [pos, setPos] = useState(0);
  const values = useMemo(() => positionalValues(pos), [pos]);
  const compare = useMemo(() => positionalValues(pos + 1), [pos]);

  return (
    <section class="study-lab" aria-labelledby="positional-lab-title">
      <h3 id="positional-lab-title">직접 조작: 위치가 바뀌면 신호 패턴이 바뀝니다</h3>
      <p>
        같은 단어라도 위치 인덱스만 바꾸면 더해지는 벡터 패턴이 달라집니다. 아래는 논문식
        sin/cos positional encoding의 축소판입니다.
      </p>
      <div class="study-lab__controls">
        <label>
          position index
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={pos}
            onInput={(event) => setPos(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <span>{pos}</span>
        </label>
      </div>
      <div class="pos-bars" aria-label="position vector dimensions">
        {values.map((value, index) => (
          <div key={index} class="pos-bars__item">
            <span class="pos-bars__label">d{index}</span>
            <div class="pos-bars__track">
              <i
                style={{
                  left: "50%",
                  width: `${Math.abs(value) * 50}%`,
                  transform: value < 0 ? "translateX(-100%)" : "none",
                  background: value < 0 ? "#a12622" : "var(--accent)",
                }}
              />
            </div>
            <span>{value.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p>
        다음 위치({pos + 1})와 비교하면 값이 조금씩 어긋납니다. 예: d0 {values[0]!.toFixed(2)} →{" "}
        {compare[0]!.toFixed(2)}
      </p>
      <p class="study-lab__note">
        Self-attention 자체는 순서를 모릅니다. 이 신호를 더해 줘야 “앞/뒤” 단서를 쓸 수 있습니다.
      </p>
    </section>
  );
}
