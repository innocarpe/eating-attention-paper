export interface QuizChoice {
  id: string;
  label: string;
}

export interface LessonQuiz {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  correctId: string;
  explanation: string;
  hint?: string;
}

export interface PracticeProblem {
  id: string;
  prompt: string;
  /** Learner types a short answer; compared case-insensitively after normalize */
  acceptedAnswers: string[];
  explanation: string;
  workedSteps: string[];
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
  goals: string[];
  sections: LessonSection[];
  formula?: string;
  workedExample?: {
    title: string;
    steps: string[];
    result: string;
  };
  widget:
    | "similarity"
    | "attention"
    | "multihead"
    | "positional"
    | "encoder-decoder"
    | "masking"
    | "none";
  quizzes: LessonQuiz[];
  practice?: PracticeProblem[];
  commonMistakes: string[];
  recap: string[];
  paperAnchor: string;
  nextId: string | null;
}
