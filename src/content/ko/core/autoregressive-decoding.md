---
title: "자기회귀 디코딩과 학습 목적 개요"
moduleId: "core.autoregressive-decoding"
kind: "core"
englishTerms: ["autoregressive decoding", "teacher forcing"]
---

# 자기회귀 디코딩과 학습 목적 개요

토큰 생성 흐름과 학습 목적의 연결, 논문 비판 입문을 다룬다.

## 영어 기술 용어
autoregressive decoding, teacher forcing

## 무엇을 배우나
- 직관: 왜 이 구성 요소가 필요한지 한국어로 설명합니다.
- 수학: 작은 숫자 예시로 계산 가능한 목표만 다룹니다.
- 구현: 결정적 fixture로 입·출력 shape와 값을 검증합니다.
- 설명: 오답이면 구조화된 설명 증거를 남깁니다(원문 자유 설명은 저장하지 않음).

## 활동
1. `act.core.autoregressive.concept`
1. `act.core.autoregressive.math`
1. `act.core.autoregressive.impl`
1. `act.core.autoregressive.explain`

## 흔한 오개념
어텐션이 단순 평균이라고 오해하기, 마스킹을 삭제 연산으로 오해하기, 멀티헤드를 단순 복제로 오해하기

## 힌트 사다리
1. 목표 문장을 다시 읽기
2. 작은 숫자 예시를 표로 다시 쓰기
3. shape와 마스크/가중치 제약을 점검하기

## 원문·인용
- Vaswani et al., 2017, §3.1, §5

## 접근성 동등성
primary 위젯과 accessible 표/폼 경로는 같은 `objectiveId`와 통과 조건을 사용합니다.
