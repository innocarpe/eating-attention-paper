# ADR-002: 배포 신뢰 경계와 Origin 분리

- 상태: 승인됨
- 결정일: 2026-07-30

## 맥락 (Context)

학습 사이트는 운영, pull request 검토, release candidate(RC)를 서로 다른 신뢰 수준으로 제공해야 한다. 브라우저의 same-origin 권한은 저장소·쿠키·서비스 워커·권한 API에 영향을 주므로, URL 경계가 약하면 검토나 RC 코드가 운영 사용자 데이터에 닿을 수 있다.

## 결정 (Decision)

GitHub Pages 운영, PR별 preview, 접근 제어된 RC를 **서로 다른 origin**으로 배포한다. origin은 scheme, host, port 조합으로 판단한다. 어떤 환경도 다른 환경과 same-origin fallback을 사용하지 않는다. 운영 배포는 검증된 기본 브랜치/승인된 릴리스 입력만 사용하며, preview와 RC는 운영 origin의 저장소·쿠키·서비스 워커를 공유하거나 재사용하지 않는다.

## 대안 (Alternatives)

- 하나의 GitHub Pages origin에서 경로만 분리: same-origin 권한을 분리하지 못하므로 채택하지 않는다.
- preview를 운영 origin으로 리디렉션: 비신뢰 PR 결과물을 운영 신뢰 경계에 들이므로 채택하지 않는다.
- RC를 공개 preview origin에 혼합: RC 접근 제어 및 감사 경계를 보장하지 못하므로 채택하지 않는다.
- origin 분리 없이 CSP만 강화: CSP는 origin 격리를 대체하지 못하므로 채택하지 않는다.

## 결과 (Consequences)

배포 구성은 세 환경의 완전한 URL을 명시적으로 관리해야 한다. PR 번호나 브랜치 이름은 preview 식별자로만 쓰고 운영 호스트/경로를 재사용하지 않는다. RC 접근 제어는 배포 플랫폼 또는 앞단에서 강제하며, 클라이언트 숨김 UI는 접근 제어 증거가 아니다. 각 origin의 서비스 워커 범위와 브라우저 저장소는 독립적으로 취급한다.

## 검증 (Verification)

**현재 확인된 사실**: 요구 계약은 GitHub Pages 운영, PR별 preview, 접근 제어 RC의 분리와 same-origin fallback 금지다.

**릴리스 시 필요한 증거**:

1. 운영, 임의 PR preview, RC의 최종 URL에서 scheme/host/port가 모두 동일하지 않음을 보여 주는 배포 기록.
2. PR 배포 입력이 해당 PR commit으로 제한되고 운영 배포 입력이 보호된 입력으로 제한됨을 보여 주는 workflow/run 기록.
3. RC URL이 인증되지 않은 요청에서 접근 거부됨을 보여 주는 플랫폼 또는 HTTP 확인 기록.
4. 각 origin에서 다른 origin의 localStorage, IndexedDB, cookie, service worker를 읽거나 제어할 수 없음을 확인한 브라우저 검사 기록.

## 실패 및 출시 금지 (Failure / No-go)

운영·preview·RC 중 둘이라도 same-origin이면 출시하지 않는다. origin 미지정 fallback, 운영 호스트로의 preview/RC 리디렉션, 또는 RC 접근 제어 미검증은 모두 출시 금지다. URL, workflow, 접근 제어를 수정한 뒤 네 가지 릴리스 증거를 다시 확보하기 전에는 어떤 환경도 신뢰된 릴리스로 승격하지 않는다.
