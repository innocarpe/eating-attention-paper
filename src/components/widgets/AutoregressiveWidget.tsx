import type { JSX } from "preact";

export interface AutoregressiveWidgetProps {
  caption?: string;
}

/** Deterministic, keyboard-friendly concept widget (no network, no persistence). */
export function AutoregressiveWidget({ caption = "자기회귀 디코딩" }: AutoregressiveWidgetProps): JSX.Element {
  return (
    <figure class="concept-widget" aria-label={caption}>
      <figcaption>
        <strong>{caption}</strong>
        <span> · English term retained in UI copy</span>
      </figcaption>
      <div class="concept-widget__body">
        <p>이전에 만든 토큰만 조건으로 다음 토큰을 예측합니다.</p>
        <ol>
          <li>작은 입력을 표로 확인합니다.</li>
          <li>허용된 조작만 키보드로 수행합니다.</li>
          <li>같은 objective의 accessible 경로와 결과가 일치해야 합니다.</li>
        </ol>
      </div>
    </figure>
  );
}

export default AutoregressiveWidget;
