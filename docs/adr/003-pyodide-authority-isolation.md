# ADR-003: Pyodide 권한 격리와 실행 기한

- 상태: 승인됨
- 결정일: 2026-07-30

## 맥락 (Context)

학습자가 입력하는 Python은 신뢰할 수 없다. 무한 실행, 대량 메모리 사용, 메시지 위조, 브라우저 페이지 권한 접근을 고려해야 한다. 실행 환경의 준비 상태와 실행 시간도 사용자 경험 및 자원 보호를 위해 한정되어야 한다.

## 결정 (Decision)

사용자 Python은 opaque origin을 갖는 sandboxed iframe 안에서만 실행한다. iframe에는 `allow-same-origin`을 부여하지 않으며, 부모 페이지의 DOM·origin 저장소·권한을 신뢰 경계 밖으로 노출하지 않는다. iframe 내부 실행 제어는 별도의 internal Worker가 담당한다. 준비(readiness) 기한은 30초, 각 실행 기한은 3초다. 부모와 iframe/Worker 사이의 메시지는 명시적 요청·응답 스키마, attempt/실행 식별자, 허용된 결과 필드만 사용한다.

## 대안 (Alternatives)

- 메인 스레드에서 Pyodide 실행: UI와 페이지 권한을 같은 실패 영역에 두므로 채택하지 않는다.
- 같은 origin iframe: 저장소와 origin 권한을 공유하므로 채택하지 않는다.
- Worker만 사용: hostile Python에 대한 opaque document/origin 경계를 제공하지 못하므로 채택하지 않는다.
- 시간 제한 없음 또는 협조적 취소만 사용: 무한 실행을 종료할 보장이 없으므로 채택하지 않는다.

## 결과 (Consequences)

실행기는 준비 시간 30초를 넘기면 준비 실패를 보고하고 해당 실행 인스턴스를 폐기한다. 실행이 3초를 넘기면 결과를 기다리지 않고 Worker 및 필요 시 iframe 인스턴스를 종료·교체하여 실행 권한을 회수한다. 타임아웃 후 늦게 도착한 메시지는 실행 식별자가 일치하더라도 폐기한다. 사용자 코드, iframe 메시지, Worker 메시지를 신뢰된 HTML로 삽입하지 않는다. 샌드박스 완화나 교차 origin 접근은 새 ADR과 보안 검토 없이는 추가하지 않는다.

## 검증 (Verification)

**현재 확인된 사실**: hostile Python은 opaque sandboxed iframe과 internal Worker에서 실행하며, readiness 30초와 execution 3초가 승인된 계약이다.

**릴리스 시 필요한 증거**:

1. 생성된 iframe의 `sandbox` 속성에 `allow-same-origin`이 없고 opaque origin으로 동작함을 보여 주는 브라우저 검사.
2. Python 실행이 메인 스레드가 아니라 iframe 내부 Worker에서 시작됨을 보여 주는 코드 경로 및 브라우저 devtools 기록.
3. 준비를 지연시킨 시나리오가 30초에 실패하고 인스턴스를 폐기함을 보여 주는 측정 기록.
4. 무한 루프 시나리오가 3초 내 종료·교체되고, 늦은 결과가 UI나 상태를 바꾸지 않음을 보여 주는 측정 기록.
5. iframe이 부모 origin의 DOM, localStorage, IndexedDB, cookie, service worker에 접근하지 못함을 보여 주는 검사.

## 실패 및 출시 금지 (Failure / No-go)

`allow-same-origin`이 존재하거나 사용자 코드가 부모/메인 스레드에서 실행되면 출시하지 않는다. 30초 준비 또는 3초 실행 기한을 강제·측정할 수 없거나 타임아웃 뒤 인스턴스를 회수하지 못해도 출시 금지다. 메시지 스키마 검증 실패, 권한 경계 접근 성공, 늦은 결과 수용이 발견되면 실행 기능을 비활성화하고 격리 구현을 수정한 뒤 모든 릴리스 증거를 재수집한다.
