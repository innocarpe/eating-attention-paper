---
title: "문제 설정과 벡터 유사도"
moduleId: "core.vector-similarity"
kind: "core"
englishTerms: ["embedding", "dot product", "cosine similarity"]
---

# 문제 설정과 벡터 유사도

어텐션 이전의 유사도 문제와 임베딩 직관을 다룬다.

## 영어 기술 용어
embedding, dot product, cosine similarity

## 무엇을 배우나
- 직관: 왜 이 구성 요소가 필요한지 한국어로 설명합니다.
- 수학: 작은 숫자 예시로 계산 가능한 목표만 다룹니다.
- 구현: 결정적 fixture로 입·출력 shape와 값을 검증합니다.
- 설명: 오답이면 구조화된 설명 증거를 남깁니다(원문 자유 설명은 저장하지 않음).

## 활동
1. `act.core.vector-similarity.concept`
1. `act.core.vector-similarity.math`
1. `act.core.vector-similarity.impl`
1. `act.core.vector-similarity.explain`

## 흔한 오개념
어텐션이 단순 평균이라고 오해하기, 마스킹을 삭제 연산으로 오해하기, 멀티헤드를 단순 복제로 오해하기

## 힌트 사다리
1. 목표 문장을 다시 읽기
2. 작은 숫자 예시를 표로 다시 쓰기
3. shape와 마스크/가중치 제약을 점검하기

## 원문·인용
- Vaswani et al., 2017, §3.2.1

## 접근성 동등성
primary 위젯과 accessible 표/폼 경로는 같은 `objectiveId`와 통과 조건을 사용합니다.
