import { useMemo, useState } from "preact/hooks";

const TOKENS = ["BOS", "나는", "고양이", "를"];

export default function MaskingLab() {
  const [queryIndex, setQueryIndex] = useState(2);

  const cells = useMemo(() => {
    return TOKENS.map((_, row) =>
      TOKENS.map((__, col) => {
        if (row !== queryIndex) return "dim";
        return col <= queryIndex ? "ok" : "blocked";
      }),
    );
  }, [queryIndex]);

  return (
    <section class="study-lab" aria-labelledby="mask-lab-title">
      <h3 id="mask-lab-title">직접 확인: Decoder 미래 마스크</h3>
      <p>
        학습 때 정답 문장을 한 번에 넣어 놓고 학습하더라도, 위치 t는 t 이후 단어를 보면 안 됩니다.
        그게 causal mask 입니다.
      </p>
      <div class="study-lab__controls">
        <label>
          현재 생성 위치
          <input
            type="range"
            min={0}
            max={TOKENS.length - 1}
            step={1}
            value={queryIndex}
            onInput={(event) =>
              setQueryIndex(Number((event.currentTarget as HTMLInputElement).value))
            }
          />
          <span>
            {queryIndex} ({TOKENS[queryIndex]})
          </span>
        </label>
      </div>
      <table class="study-table mask-table" aria-label="attention mask matrix">
        <thead>
          <tr>
            <th scope="col">Q \\ K</th>
            {TOKENS.map((token) => (
              <th key={token} scope="col">
                {token}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TOKENS.map((rowToken, row) => (
            <tr key={rowToken}>
              <th scope="row">{rowToken}</th>
              {cells[row]!.map((state, col) => (
                <td key={col} class={`mask-cell is-${state}`}>
                  {state === "blocked" ? "차단" : state === "ok" ? "허용" : "·"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p class="study-lab__note">
        지금 위치보다 오른쪽(미래)이 차단되는 게 핵심입니다. 이걸 빼면 모델이 답을 보고 베끼며
        학습합니다.
      </p>
    </section>
  );
}
