import type { LessonDefinition } from "./types";

export type { LessonDefinition, LessonQuiz, PracticeProblem } from "./types";

export const LESSONS: LessonDefinition[] = [
  {
    id: "why-attention",
    order: 1,
    title: "왜 Attention이 필요할까?",
    englishTerm: "Attention / sequence modeling",
    minutes: 18,
    summary:
      "번역·요약 같은 문제는 ‘지금 이 단어를 만들 때 앞 문장의 어디에 주목할지’를 정하는 문제입니다.",
    whyItMatters:
      "Transformer를 수식부터 보면 길을 잃기 쉽습니다. 먼저 긴 문장에서 관련 있는 부분을 골라 보는 능력이 왜 필요한지부터 잡습니다.",
    goals: [
      "Attention을 ‘관련 정보에 가중치를 주는 연산’으로 한 문장 설명할 수 있다",
      "RNN의 순차 전달 한계와 Attention의 직접 연결을 구분한다",
      "‘이해 마법’이 아니라 점수→가중치→가중합 파이프라인임을 안다",
    ],
    sections: [
      {
        heading: "한 줄로 말하면",
        body: [
          "문장을 처리할 때 모든 단어를 똑같이 보면 중요 신호가 희석됩니다.",
          "Attention은 지금 필요한 단어에 더 큰 가중치를 주는 방법입니다.",
          "결과적으로 모델은 ‘전부 보기’가 아니라 ‘잘 골라 보기’를 학습합니다.",
        ],
      },
      {
        heading: "직관 예시",
        body: [
          "문장: “The animal didn't cross the street because it was too tired.”",
          "‘it’이 animal인지 street인지는 주변 단어와의 관계로 판단합니다.",
          "Attention은 이런 관계 점수를 숫자로 만들고, 그 점수로 정보를 모아 다음 표현을 만듭니다.",
          "점수가 높을수록 그 위치의 정보를 더 많이 가져옵니다. 낮으면 거의 무시합니다.",
        ],
      },
      {
        heading: "RNN과 무엇이 다른가",
        body: [
          "RNN은 왼쪽부터 차례로 숨은 상태를 전달합니다. 먼 단어 정보는 중간에 희미해질 수 있습니다.",
          "Attention은 위치와 무관하게 모든 단어 쌍의 직접 점수를 줄 수 있어, 먼 의존 관계를 더 짧게 연결합니다.",
          "대신 모든 쌍을 보면 길이가 길수록 계산량이 커집니다. 이게 이후 효율적 Attention 연구의 출발점입니다.",
        ],
      },
      {
        heading: "이 레포에서 배울 순서",
        body: [
          "1) 왜 필요한지 2) 단어를 벡터로 3) Q/K/V Attention 계산 4) Multi-Head 5) 위치 6) Encoder-Decoder 7) 학습·비판",
          "각 레슨은 설명 → 작은 계산/조작 → 퀴즈 → 오개념 점검으로 끝납니다.",
        ],
      },
    ],
    widget: "none",
    quizzes: [
      {
        id: "why-q1",
        prompt: "Attention을 가장 잘 설명한 문장은?",
        choices: [
          { id: "a", label: "모든 단어를 항상 동일 가중치로 평균 낸다." },
          { id: "b", label: "지금 필요한 정보에 더 큰 가중치를 두어 관련 부분을 모아 본다." },
          { id: "c", label: "문장을 무조건 한 글자씩만 순서대로 처리한다." },
          { id: "d", label: "정답 문장을 외우게 만드는 검색 엔진이다." },
        ],
        correctId: "b",
        explanation:
          "Attention의 핵심은 상황마다 다른 가중치로 관련 정보를 모으는 것입니다. 단순 동일 평균이나 검색 엔진이 아닙니다.",
        hint: "‘전부 동일’이 아니라 ‘상황에 따라 다르게’가 포인트입니다.",
      },
      {
        id: "why-q2",
        prompt: "RNN 대비 Attention의 장점으로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "항상 메모리를 덜 쓴다." },
          { id: "b", label: "먼 위치 단어도 직접 점수를 매겨 연결할 수 있다." },
          { id: "c", label: "학습이 필요 없다." },
          { id: "d", label: "문장 길이가 길수록 항상 더 싸게 계산된다." },
        ],
        correctId: "b",
        explanation:
          "Attention은 쌍 점수로 먼 의존을 직접 연결할 수 있습니다. 다만 길이 증가에 따라 계산 비용은 커질 수 있습니다.",
      },
    ],
    commonMistakes: [
      "Attention을 ‘그냥 평균’으로 이해하는 것",
      "Attention을 ‘이해 마법 모듈’로 과장하는 것",
      "RNN이 항상 틀리고 Attention이 항상 정답이라고 단정하는 것",
    ],
    recap: [
      "Attention = 관련 위치에 가중치를 주는 가중합",
      "긴 의존 관계를 직접 연결할 수 있다",
      "다음 레슨: 단어를 계산 가능한 벡터로 만든다",
    ],
    paperAnchor: "Vaswani et al., 2017, Abstract & §1",
    nextId: "embeddings",
  },
  {
    id: "embeddings",
    order: 2,
    title: "단어를 숫자 벡터로 만들기",
    englishTerm: "Embedding",
    minutes: 20,
    summary:
      "컴퓨터는 글자를 그대로 계산하지 못합니다. 각 토큰을 고정 길이 벡터로 바꿔 시작 재료를 만듭니다.",
    whyItMatters:
      "Attention 계산의 입력은 전부 벡터입니다. 임베딩이 무엇을 표현하는지만 이해해도 이후 수식이 덜 무섭습니다.",
    goals: [
      "토큰→임베딩 표→벡터 흐름을 설명할 수 있다",
      "내적/코사인 유사도가 ‘비슷한 방향’을 뜻함을 안다",
      "임베딩만으로는 순서 정보가 부족함을 안다",
    ],
    sections: [
      {
        heading: "토큰 → 벡터",
        body: [
          "문장을 토큰 단위로 나눕니다. 예: [\"cat\", \"sat\", \"mat\"].",
          "각 토큰 id를 임베딩 표에서 찾아 d차원 벡터로 바꿉니다.",
          "비슷한 쓰임의 단어는 학습 후 비슷한 방향의 벡터를 갖는 경우가 많습니다.",
        ],
      },
      {
        heading: "유사도는 방향으로",
        body: [
          "두 벡터가 비슷한 방향을 보면 내적이나 코사인 유사도가 커집니다.",
          "Attention 점수도 결국 ‘query가 각 key와 얼마나 맞는지’를 유사도로 재는 데서 출발합니다.",
          "아래 랩에서 기준 벡터 [1,0]과 내 벡터를 비교해 보세요.",
        ],
      },
      {
        heading: "아직 순서는 없다",
        body: [
          "기본 단어 임베딩만 있으면 모델은 순서 정보를 모릅니다.",
          "그래서 나중에 positional encoding을 더해 ‘몇 번째 단어인지’를 알려 줍니다.",
        ],
      },
    ],
    widget: "similarity",
    quizzes: [
      {
        id: "emb-q1",
        prompt: "임베딩의 역할로 가장 알맞은 것은?",
        choices: [
          { id: "a", label: "문장 전체를 하나의 정답 문장으로 바로 번역한다." },
          { id: "b", label: "이산적인 토큰을 계산 가능한 연속 벡터로 바꾼다." },
          { id: "c", label: "Attention 가중치를 0 또는 1로만 만든다." },
          { id: "d", label: "GPU 메모리를 늘리는 하드웨어 기술이다." },
        ],
        correctId: "b",
        explanation: "임베딩은 토큰을 벡터 공간의 점으로 표현해 이후 내적·가중합 계산이 가능하게 합니다.",
      },
      {
        id: "emb-q2",
        prompt: "두 임베딩의 코사인 유사도가 1에 가깝다는 뜻은?",
        choices: [
          { id: "a", label: "두 벡터 길이가 반드시 같다." },
          { id: "b", label: "두 벡터 방향이 거의 같다." },
          { id: "c", label: "두 단어가 항상 반의어다." },
          { id: "d", label: "모델이 학습을 끝냈다." },
        ],
        correctId: "b",
        explanation: "코사인은 방향 유사도입니다. 길이(노름)와 별개로 방향이 비슷하면 1에 가까워집니다.",
      },
    ],
    practice: [
      {
        id: "emb-p1",
        prompt: "벡터 a=[1,0], b=[1,0]의 내적(dot product) 값은?",
        acceptedAnswers: ["1", "1.0"],
        explanation: "1*1 + 0*0 = 1",
        workedSteps: ["1×1 = 1", "0×0 = 0", "합 = 1"],
      },
      {
        id: "emb-p2",
        prompt: "벡터 a=[1,0], b=[0,1]의 내적은?",
        acceptedAnswers: ["0", "0.0"],
        explanation: "직교하면 내적은 0입니다.",
        workedSteps: ["1×0 = 0", "0×1 = 0", "합 = 0"],
      },
    ],
    commonMistakes: [
      "임베딩 한 원소 값을 ‘의미 점수’처럼 단독 해석하는 것",
      "유사도가 높으면 항상 동의어라고 단정하는 것",
      "임베딩만으로 어순까지 해결된다고 믿는 것",
    ],
    recap: [
      "토큰은 임베딩 벡터로 바뀐다",
      "유사도는 방향(내적/코사인)으로 본다",
      "다음: Q/K/V Attention 계산",
    ],
    paperAnchor: "Vaswani et al., 2017, §3.4",
    nextId: "dot-product-attention",
  },
  {
    id: "dot-product-attention",
    order: 3,
    title: "Scaled Dot-Product Attention",
    englishTerm: "Scaled Dot-Product Attention",
    minutes: 28,
    summary:
      "Query가 Key들과 얼마나 맞는지 점수를 매기고, Softmax로 가중치를 만든 뒤 Value를 가중합합니다.",
    whyItMatters:
      "논문 핵심 연산입니다. 이 한 줄만 손으로 계산할 수 있으면 Transformer 블록 대부분이 같은 패턴의 반복으로 보입니다.",
    goals: [
      "Q/K/V 역할을 한국어로 구분한다",
      "점수→스케일→softmax→가중합 순서를 재현한다",
      "√d_k 스케일링 이유를 설명한다",
    ],
    sections: [
      {
        heading: "세 가지 역할",
        body: [
          "Query (Q): ‘지금 내가 찾고 있는 것’",
          "Key (K): ‘각 위치가 내거는 색인/표지’",
          "Value (V): ‘실제로 가져올 내용’",
          "비유: 도서관에서 질문지(Q)를 들고 책 등기 라벨(K)과 맞춘 뒤, 책 내용(V)을 빌려 옵니다.",
        ],
      },
      {
        heading: "계산 순서",
        body: [
          "1) 점수 = Q와 K의 내적",
          "2) 스케일링: √d_k 로 나눈다",
          "3) Softmax로 가중치(합=1)를 만든다",
          "4) 가중치로 V를 가중합한다",
        ],
      },
      {
        heading: "왜 나누나",
        body: [
          "차원이 커지면 내적 값이 커지기 쉽습니다.",
          "값이 너무 크면 softmax가 한 곳에 쏠려 학습이 어려워질 수 있어 √d_k로 나눠 규모를 맞춥니다.",
        ],
      },
    ],
    formula: "Attention(Q, K, V) = softmax( (Q Kᵀ) / √d_k ) V",
    workedExample: {
      title: "손으로 하는 초소형 예시",
      steps: [
        "토큰 2개, d_k=2. query q=[1,0]",
        "key1=[1,0] → 내적 1 / key2=[0,1] → 내적 0",
        "√2≈1.414로 나누면 점수 ≈ [0.707, 0]",
        "softmax 후 첫 토큰 가중치가 더 큼",
        "그 가중치로 value를 섞으면 관련 위치 정보가 더 많이 남음",
      ],
      result: "점수가 큰 key 위치의 value가 출력에 더 크게 반영됩니다.",
    },
    widget: "attention",
    quizzes: [
      {
        id: "sdp-q1",
        prompt: "Scaled Dot-Product Attention에서 √d_k로 나누는 주된 이유는?",
        choices: [
          { id: "a", label: "임베딩 차원을 강제로 1로 줄이기 위해" },
          { id: "b", label: "내적 값이 커질 때 softmax가 극단적으로 쏠리는 현상을 완화하기 위해" },
          { id: "c", label: "Value 벡터를 삭제하기 위해" },
          { id: "d", label: "학습률을 자동으로 2배로 만들기 위해" },
        ],
        correctId: "b",
        explanation: "차원이 커지면 내적 규모가 커져 softmax가 거의 one-hot처럼 변할 수 있어 스케일링합니다.",
      },
      {
        id: "sdp-q2",
        prompt: "Softmax 이후 attention 가중치의 성질은?",
        choices: [
          { id: "a", label: "합이 0이다" },
          { id: "b", label: "합이 1이고 각 값은 0 이상이다" },
          { id: "c", label: "항상 정확히 절반씩이다" },
          { id: "d", label: "음수만 가진다" },
        ],
        correctId: "b",
        explanation: "Softmax는 비음수 가중치를 만들고 합을 1로 만들어 가중합 계수로 씁니다.",
      },
      {
        id: "sdp-q3",
        prompt: "Q/K/V 중 ‘실제로 가져올 내용’에 해당하는 것은?",
        choices: [
          { id: "a", label: "Query" },
          { id: "b", label: "Key" },
          { id: "c", label: "Value" },
          { id: "d", label: "Softmax" },
        ],
        correctId: "c",
        explanation: "가중치가 정해진 뒤 가중합되는 내용이 Value입니다.",
      },
    ],
    practice: [
      {
        id: "sdp-p1",
        prompt: "q=[2,0], k=[1,0]의 내적은?",
        acceptedAnswers: ["2", "2.0"],
        explanation: "2×1 + 0×0 = 2",
        workedSteps: ["2×1=2", "0×0=0", "합=2"],
      },
      {
        id: "sdp-p2",
        prompt: "내적 점수가 2이고 d_k=4일 때 스케일 후 점수는? (√4=2)",
        acceptedAnswers: ["1", "1.0"],
        explanation: "2 / 2 = 1",
        workedSteps: ["√d_k = √4 = 2", "2 / 2 = 1"],
      },
    ],
    commonMistakes: [
      "Softmax 이전 점수를 확률처럼 읽는 것",
      "Q/K/V를 모두 같은 벡터 복사본으로만 이해하는 것",
      "스케일링을 ‘그냥 관례’로 넘기고 이유를 모르는 것",
    ],
    recap: [
      "Attention = softmax(QKᵀ/√d_k) V",
      "Q로 찾고 K와 맞춘 뒤 V를 가져온다",
      "다음: Multi-Head로 시선을 여러 개",
    ],
    paperAnchor: "Vaswani et al., 2017, §3.2.1",
    nextId: "multi-head",
  },
  {
    id: "multi-head",
    order: 4,
    title: "Multi-Head Attention",
    englishTerm: "Multi-Head Attention",
    minutes: 22,
    summary: "한 종류의 관계만 보지 않고, 여러 head가 서로 다른 부분 공간의 관계를 동시에 봅니다.",
    whyItMatters:
      "문장 관계는 한 가지가 아닙니다. 대명사 연결, 수식 관계, 위치 패턴 등을 나눠 보면 표현력이 좋아집니다.",
    goals: [
      "단일 head 한계와 multi-head 동기를 설명한다",
      "concat 후 선형층으로 합친다는 구조를 안다",
      "head 수 증가가 만능이 아님을 안다",
    ],
    sections: [
      {
        heading: "한 head의 한계",
        body: [
          "단일 attention은 한 번의 가중합 패턴에 크게 의존합니다.",
          "여러 head로 나누면 각 head가 다른 Q/K/V 투영을 배워 다른 관계에 특화될 수 있습니다.",
        ],
      },
      {
        heading: "합치는 방법",
        body: [
          "각 head 출력을 이어 붙인(concat) 뒤 선형층 W^O 로 다시 합칩니다.",
          "‘복사 붙여넣기 여러 번’이 아니라, 서로 다른 투영을 가진 병렬 attention입니다.",
        ],
      },
      {
        heading: "아래 랩에서 볼 것",
        body: [
          "같은 문장, 같은 질의 토큰 it 인데 head 초점에 따라 가중치 분포가 달라질 수 있습니다.",
          "실제 모델 head가 항상 예쁘게 해석되진 않지만, ‘여러 시선’ 직관을 얻는 데 충분합니다.",
        ],
      },
    ],
    formula: "MultiHead(Q,K,V) = Concat(head_1, …, head_h) W^O",
    widget: "multihead",
    quizzes: [
      {
        id: "mh-q1",
        prompt: "Multi-Head Attention을 쓰는 이유로 가장 적절한 것은?",
        choices: [
          { id: "a", label: "계산을 항상 정확히 절반으로 줄이기 위해" },
          { id: "b", label: "서로 다른 관계 패턴을 병렬로 학습·포착하기 위해" },
          { id: "c", label: "Softmax를 제거하기 위해" },
          { id: "d", label: "임베딩을 문자열로 되돌리기 위해" },
        ],
        correctId: "b",
        explanation: "여러 head는 서로 다른 부분 공간에서 관계를 볼 수 있게 해 표현력을 높입니다.",
      },
      {
        id: "mh-q2",
        prompt: "각 head 출력을 합치는 일반적인 방식은?",
        choices: [
          { id: "a", label: "평균만 내고 끝낸다" },
          { id: "b", label: "이어 붙인 뒤 선형 변환한다" },
          { id: "c", label: "가장 큰 head 하나만 남긴다" },
          { id: "d", label: "랜덤으로 하나를 고른다" },
        ],
        correctId: "b",
        explanation: "표준 Multi-Head는 concat 후 W^O 로 혼합합니다.",
      },
    ],
    commonMistakes: [
      "head가 많을수록 항상 더 똑똑해진다고 단정하는 것",
      "multi-head를 단순 앙상블 투표로만 이해하는 것",
      "모든 head가 항상 해석 가능한 언어 규칙을 학습한다고 믿는 것",
    ],
    recap: [
      "여러 head = 여러 시선",
      "concat + 선형층으로 합친다",
      "다음: 위치 정보 주입",
    ],
    paperAnchor: "Vaswani et al., 2017, §3.2.2",
    nextId: "positional-encoding",
  },
  {
    id: "positional-encoding",
    order: 5,
    title: "위치 정보 넣기",
    englishTerm: "Positional Encoding",
    minutes: 20,
    summary: "Self-attention 자체는 순서를 모릅니다. 위치 인코딩을 더해 ‘몇 번째 토큰인지’를 알려 줍니다.",
    whyItMatters:
      "순서를 빼면 “dog bites man”과 “man bites dog” 같은 차이를 구조적으로 놓치기 쉽습니다.",
    goals: [
      "왜 위치 신호가 필요한지 설명한다",
      "sin/cos 위치 인코딩이 위치마다 다른 패턴을 줌을 안다",
      "단어 임베딩에 더해 쓴다는 점을 안다",
    ],
    sections: [
      {
        heading: "왜 따로 넣나",
        body: [
          "Attention은 집합에 가까운 연산이라 기본만으로는 순열에 둔감할 수 있습니다.",
          "논문은 sin/cos 함수로 만든 위치 벡터를 단어 임베딩에 더합니다.",
        ],
      },
      {
        heading: "직관",
        body: [
          "각 위치마다 고유한 패턴의 벡터를 더해, 모델이 상대적 거리 단서를 활용하게 합니다.",
          "이후 연구에는 학습 가능한 위치 임베딩, relative position 등 변형이 많습니다.",
        ],
      },
    ],
    formula: "PE(pos, 2i) = sin(pos / 10000^{2i/d}),  PE(pos, 2i+1) = cos(pos / 10000^{2i/d})",
    widget: "positional",
    quizzes: [
      {
        id: "pe-q1",
        prompt: "Transformer에 positional encoding이 필요한 이유로 맞는 것은?",
        choices: [
          { id: "a", label: "Self-attention만으로는 토큰 순서 정보가 부족할 수 있어서" },
          { id: "b", label: "Softmax를 확률로 만들기 위해서" },
          { id: "c", label: "Value 벡터 길이를 무조건 512로 고정하기 위해서" },
          { id: "d", label: "GPU 온도를 낮추기 위해서" },
        ],
        correctId: "a",
        explanation: "순서 정보를 명시적으로 주입하지 않으면 attention만으로 위치 단서가 부족할 수 있습니다.",
      },
      {
        id: "pe-q2",
        prompt: "논문의 기본 positional encoding 사용 방식은?",
        choices: [
          { id: "a", label: "단어 임베딩에 더한다" },
          { id: "b", label: "Attention 가중치를 삭제한다" },
          { id: "c", label: "Loss에만 더한다" },
          { id: "d", label: "디코더 출력 어휘를 줄인다" },
        ],
        correctId: "a",
        explanation: "입력 임베딩에 위치 벡터를 더해 순서 단서를 제공합니다.",
      },
    ],
    commonMistakes: [
      "positional encoding을 문법 규칙 표로 오해하는 것",
      "위치가 바뀌어도 표현이 완전 동일할 거라 믿는 것",
    ],
    recap: [
      "Attention은 순서를 모름 → 위치 신호 필요",
      "sin/cos 패턴을 임베딩에 더한다",
      "다음: Encoder-Decoder 전체 그림",
    ],
    paperAnchor: "Vaswani et al., 2017, §3.5",
    nextId: "encoder-decoder",
  },
  {
    id: "encoder-decoder",
    order: 6,
    title: "Encoder · Decoder와 마스크",
    englishTerm: "Encoder-Decoder / Cross-Attention / Masking",
    minutes: 26,
    summary:
      "Encoder는 입력 표현을 만들고, Decoder는 이미 만든 단어와 입력 표현을 보며 다음 단어를 생성합니다. 미래 단어는 마스크로 가립니다.",
    whyItMatters:
      "논문 그림 1 전체가 여기서 연결됩니다. self-attention / cross-attention / causal mask를 구분해야 구조를 설명할 수 있습니다.",
    goals: [
      "Encoder self-attention과 Decoder cross-attention을 구분한다",
      "causal mask가 막는 대상을 안다",
      "한 토큰 생성 루프를 단계로 설명할 수 있다",
    ],
    sections: [
      {
        heading: "Encoder",
        body: [
          "입력 임베딩 + 위치 인코딩을 받습니다.",
          "Self-Attention과 Feed-Forward를 쌓아 각 토큰 표현을 문맥화합니다.",
        ],
      },
      {
        heading: "Decoder",
        body: [
          "이미 생성한 출력을 보며 self-attention을 수행합니다 (미래 단어는 마스크).",
          "그다음 encoder 출력을 보는 cross-attention으로 원문 정보를 가져옵니다.",
          "마지막으로 다음 토큰 분포를 예측합니다.",
        ],
      },
      {
        heading: "마스크를 빼면?",
        body: [
          "학습 때 정답 문장 전체를 볼 수 있어 ‘커닝’이 됩니다.",
          "causal mask는 위치 t가 t 이후를 못 보게 해 생성 상황을 강제합니다.",
        ],
      },
    ],
    widget: "encoder-decoder",
    quizzes: [
      {
        id: "ed-q1",
        prompt: "번역 모델에서 Decoder의 cross-attention이 주로 보는 것은?",
        choices: [
          { id: "a", label: "랜덤 노이즈 테이블" },
          { id: "b", label: "Encoder가 만든 입력 문장 표현" },
          { id: "c", label: "학습률 스케줄러 상태" },
          { id: "d", label: "GPU 사용률" },
        ],
        correctId: "b",
        explanation: "Cross-attention은 디코더 상태가 인코더의 입력 표현을 조회해 원문 정보를 가져오는 경로입니다.",
      },
      {
        id: "ed-q2",
        prompt: "Decoder causal mask가 차단하는 것은?",
        choices: [
          { id: "a", label: "이미 생성된 과거 토큰" },
          { id: "b", label: "현재 위치보다 미래의 토큰" },
          { id: "c", label: "임베딩 차원" },
          { id: "d", label: "배치 크기" },
        ],
        correctId: "b",
        explanation: "미래 위치를 가려 생성 시점의 정보만 쓰게 합니다.",
      },
      {
        id: "ed-q3",
        prompt: "Encoder self-attention의 범위는?",
        choices: [
          { id: "a", label: "원문(입력) 토큰들 사이의 관계" },
          { id: "b", label: "출력 어휘 전체" },
          { id: "c", label: "학습률만" },
          { id: "d", label: "손실 함수 하이퍼파라미터" },
        ],
        correctId: "a",
        explanation: "Encoder는 입력 문장 내부 문맥을 만듭니다.",
      },
    ],
    practice: [
      {
        id: "ed-p1",
        prompt:
          "위치가 0,1,2일 때 query 위치 1이 볼 수 있는 key 위치를 콤마로 쓰세요 (예: 0,1)",
        acceptedAnswers: ["0,1", "0, 1"],
        explanation: "causal mask에서 위치 1은 0과 1만 볼 수 있습니다.",
        workedSteps: ["미래 위치 2는 차단", "과거·현재 0,1만 허용"],
      },
    ],
    commonMistakes: [
      "Encoder self-attention과 Decoder cross-attention을 혼동하는 것",
      "마스크를 ‘패딩 삭제’로만 이해하는 것 (causal mask는 미래 차단)",
    ],
    recap: [
      "Encoder: 입력 문맥화",
      "Decoder: 과거 self + 원문 cross + 다음 단어",
      "다음: 학습 신호와 비판적 읽기",
    ],
    paperAnchor: "Vaswani et al., 2017, §3.1",
    nextId: "training-and-critique",
  },
  {
    id: "training-and-critique",
    order: 7,
    title: "학습 신호와 논문 읽기 포인트",
    englishTerm: "Training objective / BLEU / limitations",
    minutes: 22,
    summary:
      "다음 토큰을 맞추는 학습 신호, 실험 지표, 그리고 논문 주장을 비판적으로 읽는 포인트를 정리합니다.",
    whyItMatters:
      "구현만 따라 하면 ‘왜 이 설계가 이겼다고 주장하는지’를 놓칩니다. 제대로 이해하려면 한계와 지표도 같이 봐야 합니다.",
    goals: [
      "다음 토큰 예측 학습 신호를 설명한다",
      "BLEU를 절대 진리가 아닌 단서로 읽는다",
      "계산 비용 등 한계를 한 가지 이상 말할 수 있다",
    ],
    sections: [
      {
        heading: "무엇을 최적화하나",
        body: [
          "전형적인 시퀀스 모델처럼 다음 토큰 예측 손실을 사용합니다.",
          "논문은 학습 안정/일반화를 위해 label smoothing 등 정규화 기법도 사용합니다.",
        ],
      },
      {
        heading: "실험 표를 읽는 법",
        body: [
          "BLEU 같은 지표는 ‘유용한 단서’이지 ‘이해의 절대 증명’이 아닙니다.",
          "데이터, 계산량, 하이퍼파라미터, 구현 디테일이 결과 해석을 바꿉니다.",
        ],
      },
      {
        heading: "한계를 함께 적자",
        body: [
          "Self-attention은 시퀀스 길이에 따라 비용이 빠르게 커질 수 있습니다.",
          "이후 연구(효율적 attention, 사전학습 언어모델 등)가 이 출발점 위에 쌓였습니다.",
        ],
      },
      {
        heading: "여기까지 오면",
        body: [
          "당신은 논문의 핵심 블록을 ‘왜/무엇/어떻게/한계’로 설명할 수 있는 상태에 가깝습니다.",
          "원문 §3을 다시 읽으면 용어가 훨씬 덜 이질적으로 느껴질 것입니다.",
          "더 깊게 가려면 작은 구현·캡스톤 설명·실험 표 재해석으로 확장하세요.",
        ],
      },
    ],
    widget: "none",
    quizzes: [
      {
        id: "tr-q1",
        prompt: "논문 결과를 가장 건전하게 해석하는 태도는?",
        choices: [
          { id: "a", label: "BLEU가 높으면 모델이 언어를 인간처럼 이해한다고 단정한다." },
          { id: "b", label: "지표·데이터·계산 비용·한계를 함께 읽고 주장을 검토한다." },
          { id: "c", label: "수식이 복잡하면 실험 결과는 무시한다." },
          { id: "d", label: "저자 소속 기관만 보고 진위를 판단한다." },
        ],
        correctId: "b",
        explanation: "실험 주장은 지표와 조건을 함께 읽고, 한계와 대안 설명 가능성을 남겨 두는 편이 안전합니다.",
      },
      {
        id: "tr-q2",
        prompt: "Self-attention의 대표적 한계로 적절한 것은?",
        choices: [
          { id: "a", label: "절대 병렬 계산이 불가능하다" },
          { id: "b", label: "시퀀스가 길어질수록 쌍 계산 비용이 커질 수 있다" },
          { id: "c", label: "벡터를 쓸 수 없다" },
          { id: "d", label: "마스크를 절대 적용할 수 없다" },
        ],
        correctId: "b",
        explanation: "모든 쌍을 보면 길이에 따라 비용이 커질 수 있어 효율화 연구가 이어졌습니다.",
      },
    ],
    commonMistakes: [
      "벤치마크 점수 상승을 곧바로 일반 지능 증명으로 비약하는 것",
      "학습 목표(다음 토큰)와 평가 지표(BLEU 등)를 같은 것으로 혼동하는 것",
    ],
    recap: [
      "학습: 다음 토큰 예측 (+ 정규화)",
      "평가는 단서일 뿐 절대 진리 아님",
      "한계(길이-비용 등)를 같이 읽자",
    ],
    paperAnchor: "Vaswani et al., 2017, §5–§6",
    nextId: null,
  },
];

export function getLesson(id: string): LessonDefinition | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

export function getOrderedLessons(): LessonDefinition[] {
  return [...LESSONS].sort((a, b) => a.order - b.order);
}
