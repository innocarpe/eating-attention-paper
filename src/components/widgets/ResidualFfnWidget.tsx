import type { JSX } from "preact";

export interface ResidualFfnWidgetProps {
  caption?: string;
}

/** Deterministic, keyboard-friendly concept widget (no network, no persistence). */
export function ResidualFfnWidget({ caption = "Residual / FFN" }: ResidualFfnWidgetProps): JSX.Element {
  return (
    <figure class="concept-widget" aria-label={caption}>
      <figcaption>
        <strong>{caption}</strong>
        <span> · English term retained in UI copy</span>
      </figcaption>
      <div class="concept-widget__body">
        <p>잔차 연결과 위치별 전결합층이 표현력을 보강합니다.</p>
        <ol>
          <li>작은 입력을 표로 확인합니다.</li>
          <li>허용된 조작만 키보드로 수행합니다.</li>
          <li>같은 objective의 accessible 경로와 결과가 일치해야 합니다.</li>
        </ol>
      </div>
    </figure>
  );
}

export default ResidualFfnWidget;
