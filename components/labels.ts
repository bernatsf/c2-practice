import type { Category, SessionMode } from "@/lib/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  phrasal_verb: "Phrasal Verbs",
  preposition: "Prepositions",
  collocation: "Collocations",
  fixed_phrase: "Fixed Phrases",
  idiom: "Idioms",
  linking_word: "Linking Words",
  false_friend: "False Friends",
  word_formation: "Word Formation",
  lexical: "Lexical",
  grammar: "Grammar",
};

export const MODE_LABEL: Record<SessionMode, string> = {
  part1: "Part 1 · Multiple-choice cloze",
  part2: "Part 2 · Open cloze",
  part3: "Part 3 · Word formation",
  part4: "Part 4 · Key word transformation",
  mixed: "Mixed · All parts",
  srs: "Review · Failed items",
};
