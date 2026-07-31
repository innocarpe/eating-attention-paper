export interface PracticeProblem {
  id: string;
  prompt: string;
  /** Optional short answer check; not required to proceed */
  acceptedAnswers?: string[];
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
  practice?: PracticeProblem[];
  commonMistakes: string[];
  recap: string[];
  paperAnchor: string;
  nextId: string | null;
}
