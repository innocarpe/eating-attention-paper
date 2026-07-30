import type { JSX } from "preact";

export interface EmbeddingPositionWidgetProps {
  caption?: string;
}

/** Deterministic, keyboard-friendly concept widget (no network, no persistence). */
export function EmbeddingPositionWidget({ caption = "임베딩 + 위치" }: EmbeddingPositionWidgetProps): JSX.Element {
  return (
    <figure class="concept-widget" aria-label={caption}>
      <figcaption>
        <strong>{caption}</strong>
        <span> · English term retained in UI copy</span>
      </figcaption>
      <div class="concept-widget__body">
        <p>토큰 임베딩과 위치 인코딩을 더해 순서 정보를 넣습니다.</p>
        <ol>
          <li>작은 입력을 표로 확인합니다.</li>
          <li>허용된 조작만 키보드로 수행합니다.</li>
          <li>같은 objective의 accessible 경로와 결과가 일치해야 합니다.</li>
        </ol>
      </div>
    </figure>
  );
}

export default EmbeddingPositionWidget;
