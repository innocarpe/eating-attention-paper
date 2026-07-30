---
title: "심화: 실험 해석"
moduleId: "deep.experiment-interpretation"
kind: "deep-dive"
englishTerms: ["ablation", "BLEU", "variation"]
---

# 심화: 실험 해석

논문 실험 표와 ablation을 비판적으로 해석한다.

## 영어 기술 용어
ablation, BLEU, variation

## 무엇을 배우나
- 직관: 왜 이 구성 요소가 필요한지 한국어로 설명합니다.
- 수학: 작은 숫자 예시로 계산 가능한 목표만 다룹니다.
- 구현: 결정적 fixture로 입·출력 shape와 값을 검증합니다.
- 설명: 오답이면 구조화된 설명 증거를 남깁니다(원문 자유 설명은 저장하지 않음).

## 활동
1. `act.deep.experiments.concept`
1. `act.deep.experiments.check`

## 흔한 오개념
복잡도 표기를 벽시계 시간으로 오해하기, 실험 표를 인과로 과대 해석하기

## 힌트 사다리
1. 목표 문장을 다시 읽기
2. 작은 숫자 예시를 표로 다시 쓰기
3. shape와 마스크/가중치 제약을 점검하기

## 원문·인용
- Vaswani et al., 2017, §6

## 접근성 동등성
primary 위젯과 accessible 표/폼 경로는 같은 `objectiveId`와 통과 조건을 사용합니다.
