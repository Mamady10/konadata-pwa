export type NgoSurveyQuestionType = 'yes_no' | 'single_choice' | 'number' | 'text';

export interface NgoSurveyQuestion {
  id: string;
  text: string;
  type: NgoSurveyQuestionType;
  required?: boolean;
  options?: string[];
}

export const QUESTION_TYPE_LABELS: Record<NgoSurveyQuestionType, string> = {
  yes_no: 'Oui / Non',
  single_choice: 'Choix unique',
  number: 'Nombre',
  text: 'Texte libre',
};

export function parseSurveyQuestions(raw: unknown): NgoSurveyQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const q = item as Record<string, unknown>;
      const type = (q.type as NgoSurveyQuestionType) ?? 'yes_no';
      return {
        id: String(q.id ?? `q${index + 1}`),
        text: String(q.text ?? '').trim(),
        type: ['yes_no', 'single_choice', 'number', 'text'].includes(type) ? type : 'yes_no',
        required: q.required !== false,
        options: Array.isArray(q.options) ? q.options.map(String) : undefined,
      };
    })
    .filter((q) => q.text.length > 0);
}

export function buildDefaultQuestions(mainText?: string): NgoSurveyQuestion[] {
  const text = mainText?.trim() || 'Question principale';
  return [{ id: 'q1', text, type: 'yes_no', required: true }];
}

/** QCM à choix unique (ex. 3 réponses attendues par le directeur). */
export function buildQcmQuestion(text: string, options: string[]): NgoSurveyQuestion[] {
  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  return [
    {
      id: 'q1',
      text: text.trim(),
      type: 'single_choice',
      required: true,
      options: cleaned,
    },
  ];
}
