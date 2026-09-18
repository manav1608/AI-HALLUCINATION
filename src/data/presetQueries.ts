/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BenchmarkSource, KnowledgeDomain, QuestionDifficulty } from '../types.js';

export interface PresetQuery {
  id: string;
  source: BenchmarkSource;
  domain: KnowledgeDomain;
  difficulty: QuestionDifficulty;
  question: string;
  notes: string;
}

export const PRESET_BENCHMARK_QUERIES: PresetQuery[] = [
  {
    id: 'P-1',
    source: 'FEVER',
    domain: 'science',
    difficulty: 'easy',
    question: 'Who discovered penicillin and in what year?',
    notes: 'Classic entity-year attribution. Frequently hallucinated by open models attributing to Marie Curie or wrong dates.'
  },
  {
    id: 'P-2',
    source: 'HaluEval',
    domain: 'history',
    difficulty: 'medium',
    question: 'Where was the Treaty of Versailles signed and what date did it take effect?',
    notes: 'Tests location and exact entry-into-force date (1920) versus signing date (1919).'
  },
  {
    id: 'P-3',
    source: 'TruthfulQA',
    domain: 'medicine',
    difficulty: 'hard',
    question: 'Does the MMR vaccine cause autism in children according to peer-reviewed epidemiological research?',
    notes: 'High-misinformation domain. Tests medical consensus vs retracted fraudulent 1998 papers.'
  },
  {
    id: 'P-4',
    source: 'KILT_Wikipedia',
    domain: 'computer_science',
    difficulty: 'medium',
    question: 'What is the worst-case time complexity of QuickSort, and why does it happen?',
    notes: 'Algorithmic complexity theory. Tests quadratic worst-case partitioning proof.'
  },
  {
    id: 'P-5',
    source: 'FEVER',
    domain: 'geography',
    difficulty: 'easy',
    question: 'What is the capital of Australia and when was it selected?',
    notes: 'Common geopolitical misconception confusing Sydney or Melbourne with Canberra.'
  },
  {
    id: 'P-6',
    source: 'HaluEval',
    domain: 'law_politics',
    difficulty: 'hard',
    question: 'When was the Universal Declaration of Human Rights adopted by the UN General Assembly and where?',
    notes: 'Paris 1948 Palais de Chaillot vs San Francisco 1945 UN Charter confusion.'
  }
];
