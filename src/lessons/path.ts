export type LessonKind = "concept" | "math" | "check";

export interface QuizChoice {
  id: string;
  label: string;
}

export interface LessonQuiz {
  prompt: string;
  choices: QuizChoice[];
  correctId: string;
  explanation: string;
}

export interface LessonSection {
  heading: string;
  body: string[];
}

export interface LessonDefinition {
  id: string;
  order: number;
  title: string;
  englishTerm: string;
  minutes: number;
  summary: string;
  whyItMatters: string;
  sections: LessonSection[];
  formula?: string;
  workedExample?: {
    title: string;
    steps: string[];
    result: string;
  };
  widget: "similarity" | "attention" | "multihead" | "positional" | "encoder-decoder" | "none";
  quiz: LessonQuiz;
  commonMistake: string;
  paperAnchor: string;
  nextId: string | null;
}

export const LESSONS: LessonDefinition[] = [
  {
    id: "why-attention",
    order: 1,
    title: "왜 Attention이 필요할까?",
    englishTerm: "Attention / sequence modeling",
    minutes: 12,
    summary: "번역·요약 같은 문제는 ‘지금 이 단어를 만들 때 앞 문장의 어디에 주목할지’를 정하는 문제입니다.",
    whyItMatters:
      "Transformer를 수식부터 보면 길을 잃기 쉽습니다. 먼저 ‘긴 문장에서 관련 있는 부분을 골라 보는 능력’이 왜 필요한지부터 잡습니다.",
    sections: [
      {
        heading: "한 줄로 말하면",
        body: [
          "문장을 처리할 때 모든 단어를 똑같이 보면 중요 신호가 희석됩니다.",
          "Attention은 ‘지금 필요한 단어에 더 큰 가중치’를 주는 방법입니다.",
        ],
      },
      {
        heading: "직관 예시",
        body: [
          "문장: “The animal didn't cross the street because it was too tired.”",
          "‘it’이 가리키는 대상이 animal인지 street인지는 주변 단어와의 관계로 판단합니다.",
          "Attention은 이런 관계 점수를 숫자로 만들고, 그 점수로 정보를 모아 다음 표현을 만듭니다.",
        ],
      },
      {
        heading: "RNN과 무엇이 다른가",
        body: [
          "RNN은 왼쪽부터 차례로 숨은 상태를 전달합니다. 먼 단어 정보는 중간에 많이 희미해질 수 있습니다.",
          "Attention은 위치와 무관하게 모든 단어 쌍의 직접 점수를 줄 수 있어, 먼 의존 관계를 더 짧게 연결합니다.",
        ],
      },
    ],
    widget: "none",
    quiz: {
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
    },
    commonMistake: "Attention을 ‘그냥 평균’ 또는 ‘마법의 이해 모듈’로 과장해 이해하는 것.",
    paperAnchor: "Vaswani et al., 2017, Abstract & §1",
    nextId: "embeddings",
  },
  {
    id: "embeddings",
    order: 2,
    title: "단어를 숫자 벡터로 만들기",
    englishTerm: "Embedding",
    minutes: 15,
    summary: "컴퓨터는 글자를 그대로 계산하지 못합니다. 각 토큰을 고정 길이 벡터로 바꿔 시작 재료를 만듭니다.",
    whyItMatters:
      "Attention 계산의 입력은 전부 벡터입니다. 임베딩이 무엇을 표현하는지만 이해해도 이후 수식이 덜 무섭습니다.",
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
        heading: "아직 순서는 없다",
        body: [
          "기본 단어 임베딩만 있으면 모델은 순서 정보를 모릅니다.",
          "그래서 나중에 positional encoding을 더해 ‘몇 번째 단어인지’를 알려 줍니다.",
        ],
      },
    ],
    widget: "similarity",
    quiz: {
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
    commonMistake: "임베딩 벡터 값 하나를 ‘의미 점수’처럼 단독 해석하는 것. 보통은 방향/관계가 중요합니다.",
    paperAnchor: "Vaswani et al., 2017, §3.4",
    nextId: "dot-product-attention",
  },
  {
    id: "dot-product-attention",
    order: 3,
    title: "Scaled Dot-Product Attention",
    englishTerm: "Scaled Dot-Product Attention",
    minutes: 20,
    summary: "Query가 Key들과 얼마나 맞는지 점수를 매기고, Softmax로 가중치를 만든 뒤 Value를 가중합합니다.",
    whyItMatters:
      "논문 핵심 연산입니다. 이 한 줄만 손으로 계산할 수 있으면 Transformer 블록 대부분이 같은 패턴의 반복으로 보입니다.",
    sections: [
      {
        heading: "세 가지 역할",
        body: [
          "Query (Q): ‘지금 내가 찾고 있는 것’",
          "Key (K): ‘각 위치가 내거는 색인/표지’",
          "Value (V): ‘실제로 가져올 내용’",
        ],
      },
      {
        heading: "계산 순서",
        body: [
          "1) 점수 = Q와 K의 내적",
          "2) 스케일링: √d_k 로 나눈다 (값이 커져 softmax가 한쪽에 쏠리는 것을 완화)",
          "3) Softmax로 가중치(합=1)를 만든다",
          "4) 가중치로 V를 가중합한다",
        ],
      },
    ],
    formula: "Attention(Q, K, V) = softmax( (Q Kᵀ) / √d_k ) V",
    workedExample: {
      title: "아주 작은 숫자 예시",
      steps: [
        "토큰 2개, d_k = 2라고 가정합니다.",
        "한 query와 두 key의 내적 점수가 [2, 0]이면, √2 ≈ 1.414로 나눠 [1.414, 0]이 됩니다.",
        "Softmax를 하면 첫 토큰 가중치가 더 커집니다.",
        "그 가중치로 value 벡터들을 섞으면 ‘더 관련 있는 쪽 정보’가 많이 남습니다.",
      ],
      result: "점수가 큰 key 위치의 value가 출력에 더 크게 반영됩니다.",
    },
    widget: "attention",
    quiz: {
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
    commonMistake: "Softmax 이전 점수를 확률처럼 읽거나, Q/K/V를 모두 ‘같은 의미의 복사본’으로만 이해하는 것.",
    paperAnchor: "Vaswani et al., 2017, §3.2.1",
    nextId: "multi-head",
  },
  {
    id: "multi-head",
    order: 4,
    title: "Multi-Head Attention",
    englishTerm: "Multi-Head Attention",
    minutes: 15,
    summary: "한 종류의 관계만 보지 않고, 여러 head가 서로 다른 부분 공간의 관계를 동시에 봅니다.",
    whyItMatters:
      "문장 관계는 한 가지가 아닙니다. 대명사 연결, 수식 관계, 위치 패턴 등을 나눠 보면 표현력이 좋아집니다.",
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
          "각 head 출력을 이어 붙인(concat) 뒤 선형층으로 다시 합칩니다.",
          "‘복사 붙여넣기 여러 번’이 아니라, 서로 다른 투영을 가진 병렬 attention입니다.",
        ],
      },
    ],
    formula: "MultiHead(Q,K,V) = Concat(head_1, …, head_h) W^O",
    widget: "multihead",
    quiz: {
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
    commonMistake: "head가 많을수록 항상 더 똑똑해진다고 단정하는 것. 데이터·계산 비용·차원 분할과 함께 봐야 합니다.",
    paperAnchor: "Vaswani et al., 2017, §3.2.2",
    nextId: "positional-encoding",
  },
  {
    id: "positional-encoding",
    order: 5,
    title: "위치 정보 넣기",
    englishTerm: "Positional Encoding",
    minutes: 15,
    summary: "Self-attention 자체는 순서를 모릅니다. 위치 인코딩을 더해 ‘몇 번째 토큰인지’를 알려 줍니다.",
    whyItMatters:
      "순서를 빼면 “dog bites man”과 “man bites dog” 같은 차이를 구조적으로 놓치기 쉽습니다.",
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
    widget: "positional",
    quiz: {
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
    commonMistake: "positional encoding을 ‘문법 규칙을 직접 저장한 표’로 오해하는 것. 실제로는 위치 단서 신호입니다.",
    paperAnchor: "Vaswani et al., 2017, §3.5",
    nextId: "encoder-decoder",
  },
  {
    id: "encoder-decoder",
    order: 6,
    title: "Encoder · Decoder 전체 그림",
    englishTerm: "Encoder-Decoder / Cross-Attention",
    minutes: 18,
    summary: "Encoder는 입력 문장을 풍부한 표현으로 바꾸고, Decoder는 이미 만든 단어와 입력 표현을 보며 다음 단어를 생성합니다.",
    whyItMatters:
      "논문 그림 1의 전체가 여기서 연결됩니다. 블록을 ‘검은 상자’가 아니라 데이터 흐름으로 볼 수 있게 됩니다.",
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
    ],
    widget: "encoder-decoder",
    quiz: {
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
    commonMistake: "Encoder self-attention과 Decoder cross-attention을 구분하지 못하는 것.",
    paperAnchor: "Vaswani et al., 2017, §3.1",
    nextId: "training-and-critique",
  },
  {
    id: "training-and-critique",
    order: 7,
    title: "학습 신호와 논문 읽기 포인트",
    englishTerm: "Training objective / BLEU / limitations",
    minutes: 15,
    summary: "다음 토큰을 맞추는 학습 신호, 실험 지표, 그리고 논문 주장을 비판적으로 읽는 포인트를 정리합니다.",
    whyItMatters:
      "구현만 따라 하면 ‘왜 이 설계가 이겼다고 주장하는지’를 놓칩니다. 셀프 브랜딩용 학습 노트에도 비판 관점이 필요합니다.",
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
    ],
    widget: "none",
    quiz: {
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
    commonMistake: "벤치마크 점수 상승을 곧바로 ‘일반 지능의 증명’으로 비약하는 것.",
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
