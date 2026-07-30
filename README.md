# Attention Is All You Need 학습 프로젝트

`Attention Is All You Need` 논문을 처음 배우는 사람이 Transformer를 **직접 설명하고 작은 구성 요소를 검증할 수 있도록** 돕는 한국어 우선 학습 자료입니다. 설명은 한국어를 기본으로 하되, 경로·콘텐츠 ID·데이터 계약은 특정 언어에 묶이지 않게 설계합니다.

## 학습 구성

계획된 본문은 8개의 핵심 레슨과 3개의 선택 레슨으로 구성됩니다. 핵심 레슨은 문제 맥락, self-attention, multi-head attention, positional encoding, encoder/decoder, 학습과 추론, 마스킹, 전체 Transformer를 차례로 다룹니다. 선택 레슨은 더 깊은 수학, 구현 실험, 읽을거리 확장을 위한 보조 경로입니다.

학습자는 정답을 외우는 대신, 입력과 출력의 모양·마스크·attention 가중치가 왜 필요한지 작은 예제와 결정적인 평가기로 확인하는 것을 목표로 합니다.

## 기술과 개인정보 원칙

- 정적 **Astro**, 엄격한 TypeScript, MDX, 필요한 상호작용에만 Preact island를 사용합니다.
- 학습 데이터와 진행 상태는 기본적으로 브라우저 로컬에만 둡니다.
- 분석은 기본 비활성화이며, 원시 학습자 데이터나 식별 가능한 학습 기록을 수집·전송하지 않습니다.
- 공개 배포가 이루어질 경우에도 운영, 미리보기, RC는 서로 다른 origin을 사용해야 합니다. 같은 origin으로 대체하지 않습니다.

## 현재 상태

이 저장소는 학습 사이트의 구현 기반을 공개 중입니다. 레슨 콘텐츠 완성도, 외부 검토, 학습자 검증, **출시(launch) 승인**이 끝났다고 주장하지 않습니다.

## 시작하기

Node.js와 npm을 준비한 뒤 의존성을 설치합니다.

```sh
npm install
npm run dev
```

정적 결과물을 확인하려면 다음을 사용합니다.

```sh
npm run build
npm run preview
```

## 검증 명령

```sh
npm run check
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 배포 상태

- **Production (GitHub Pages, unlaunched):** https://innocarpe.github.io/eating-attention-paper/
- 저장소: https://github.com/innocarpe/eating-attention-paper
- Pages 워크플로로 정적 아티팩트를 배포했습니다. 이는 **호스팅 배포**이며 출시 승인/학습 효과 검증 완료를 의미하지 않습니다.
- Preview/RC는 production과 다른 origin 계약을 유지합니다. 현재 preview/RC 실호스팅 provider는 아직 연결하지 않았습니다.

## 기여와 라이선스

기여 방식은 [CONTRIBUTING.md](CONTRIBUTING.md), 행동 기준은 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), 보안 제보 방식은 [SECURITY.md](SECURITY.md)를 참고하세요. 이 프로젝트는 [Apache License 2.0](LICENSE)으로 제공됩니다.


## 캡스톤 · 출시 · 프라이버시

- 캡스톤 템플릿: `capstone-template/`
- 출시 준비 보드(정직한 미완료 표시): 사이트 `/release/`, 문서 `docs/release/readiness-report.md`
- 데이터 흐름 목록: `docs/privacy/data-flow-inventory.md`
- 독립 검토/브라우저/AT/학습자 5+5 증거 없이 출시 완료를 주장하지 않습니다.
