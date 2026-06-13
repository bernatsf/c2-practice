import type { Category, Part, Question } from "./types";
import rawData from "../cpe_use_of_english.json";

// The item bank is authored in /cpe_use_of_english.json (single source of truth)
// and adapted here to the internal Question shape. This is also the seam where
// LLM-generated items would be merged in later.

interface RawItem {
  id: string;
  part: number;
  category: string;
  questionText: string;
  options: string[] | null;
  baseWord: string | null;
  targetSentence: string | null;
  correctAnswer: string;
  explanation: string;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];

function mapCategory(raw: string): Category {
  switch (raw) {
    case "False Friend":
      return "false_friend";
    case "Phrasal Verb":
      return "phrasal_verb";
    case "Preposition":
      return "preposition";
    case "Lexical":
      return "lexical";
    default:
      return "grammar";
  }
}

// No difficulty is authored in the JSON, so derive an ELO baseline from the
// category/part. Items keep this fixed difficulty; the user's rating moves.
function difficultyFor(part: number, cat: Category): number {
  const base: Partial<Record<Category, number>> = {
    false_friend: 1750,
    phrasal_verb: 1720,
    preposition: 1680,
  };
  return (base[cat] ?? 1700) + (part === 4 ? 40 : 0);
}

function toQuestion(r: RawItem): Question {
  const part = r.part as Part;
  const category = mapCategory(r.category);
  const base = {
    id: r.id,
    part,
    category,
    difficulty: difficultyFor(part, category),
    explanation: r.explanation,
    source: "seed" as const,
  };

  // Part 1: options are plain strings; correctAnswer is the option TEXT.
  if (part === 1) {
    const options = (r.options ?? []).map((text, i) => ({ key: OPTION_KEYS[i], text }));
    const correct = options.find(
      (o) => o.text.trim().toLowerCase() === r.correctAnswer.trim().toLowerCase()
    );
    return { ...base, context: r.questionText, options, answers: [correct?.key ?? "A"] };
  }

  // Part 4: lead sentence + gapped second sentence + a mandatory key word.
  if (part === 4) {
    return {
      ...base,
      leadSentence: r.questionText,
      gapped: r.targetSentence ?? "",
      keyWord: r.baseWord ?? undefined,
      answers: [r.correctAnswer],
    };
  }

  // Parts 2 & 3: single gapped sentence; Part 3 also supplies a root word.
  return {
    ...base,
    context: r.questionText,
    rootWord: part === 3 ? r.baseWord ?? undefined : undefined,
    answers: [r.correctAnswer],
  };
}

export const SEED_BANK: Question[] = (rawData as RawItem[]).map(toQuestion);
