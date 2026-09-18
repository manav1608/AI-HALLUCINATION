/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BenchmarkSource, KnowledgeDomain, QuestionDifficulty, ClaimType, LLMModel } from '../src/types.js';

export interface RawBenchmarkItem {
  id: string;
  source: BenchmarkSource;
  domain: KnowledgeDomain;
  difficulty: QuestionDifficulty;
  question: string;
  groundTruth: string;
  modelVariants: Record<LLMModel, {
    nonRagText: string;
    ragText: string;
    nonRagClaims: Array<{
      text: string;
      type: ClaimType;
      verdict: 'supported' | 'refuted' | 'unknown';
      entailment: number;
      contradiction: number;
      neutral: number;
      evidence: { docId: string; title: string; text: string; bm25: number };
    }>;
    ragClaims: Array<{
      text: string;
      type: ClaimType;
      verdict: 'supported' | 'refuted' | 'unknown';
      entailment: number;
      contradiction: number;
      neutral: number;
      evidence: { docId: string; title: string; text: string; bm25: number };
    }>;
  }>;
}

export const BENCHMARK_ITEMS: RawBenchmarkItem[] = [
  {
    id: 'BENCH-001',
    source: 'FEVER',
    domain: 'science',
    difficulty: 'easy',
    question: 'Who discovered penicillin and in what year?',
    groundTruth: 'Alexander Fleming discovered penicillin in 1928 at St. Mary’s Hospital in London.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'Penicillin was discovered by Scottish physician Alexander Fleming in September 1928 at St. Mary\'s Hospital London.',
        ragText: 'According to historical records, Alexander Fleming discovered penicillin in 1928 after observing contaminated petri dishes at St. Mary\'s Hospital, London.',
        nonRagClaims: [
          {
            text: 'Penicillin was discovered by Alexander Fleming.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Alexander Fleming FRS FRSE FRCS was a Scottish physician and microbiologist, best known for discovering penicillin in 1928.', bm25: 18.4 }
          },
          {
            text: 'The discovery occurred in September 1928.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.95,
            contradiction: 0.02,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'On September 3, 1928, Fleming returned to his laboratory having spent the month of August with his family.', bm25: 16.9 }
          },
          {
            text: 'The discovery took place at St. Mary\'s Hospital London.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Fleming conducted his bacteriological research at St. Mary\'s Hospital Medical School, London.', bm25: 17.1 }
          }
        ],
        ragClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in 1928.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Best known for discovering the world’s first broadly effective antibiotic substance, penicillin, in 1928.', bm25: 21.0 }
          },
          {
            text: 'The discovery occurred at St. Mary\'s Hospital in London.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Fleming worked at St. Mary\'s Hospital Medical School in London.', bm25: 19.3 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'Marie Curie discovered penicillin in 1898 during her early research on radium and antibiotics in Paris.',
        ragText: 'Retrieved archives confirm Alexander Fleming discovered penicillin in September 1928 at St. Mary\'s Hospital in London.',
        nonRagClaims: [
          {
            text: 'Marie Curie discovered penicillin.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.96,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-3829', title: 'Marie Curie', text: 'Marie Curie was a Polish-French physicist who conducted pioneering research on radioactivity, discovering polonium and radium. Penicillin was discovered by Alexander Fleming.', bm25: 22.1 }
          },
          {
            text: 'The discovery was made in the year 1898.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.04,
            contradiction: 0.92,
            neutral: 0.04,
            evidence: { docId: 'KILT-WIKI-4921', title: 'History of Penicillin', text: 'Penicillin was discovered in 1928 by Alexander Fleming, not in 1898.', bm25: 19.8 }
          },
          {
            text: 'The research was conducted on radium and antibiotics in Paris.',
            type: 'causal',
            verdict: 'refuted',
            entailment: 0.05,
            contradiction: 0.88,
            neutral: 0.07,
            evidence: { docId: 'KILT-WIKI-3829', title: 'Marie Curie', text: 'Curie discovered radium in 1898 in Paris, but this had no connection with antibiotics or penicillin.', bm25: 15.6 }
          }
        ],
        ragClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in September 1928.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Alexander Fleming discovered penicillin in September 1928.', bm25: 20.8 }
          },
          {
            text: 'The laboratory was located at St. Mary\'s Hospital in London.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.96,
            contradiction: 0.02,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'He isolated the mould at St. Mary\'s Hospital, London.', bm25: 17.5 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'Alexander Fleming discovered penicillin in 1928, and it was synthesized industrially by Howard Florey and Ernst Chain in Oxford by 1940.',
        ragText: 'Penicillin was discovered by Scottish scientist Alexander Fleming in 1928 at St. Mary’s Hospital, London.',
        nonRagClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in 1928.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Fleming discovered penicillin in 1928.', bm25: 21.0 }
          },
          {
            text: 'It was synthesized industrially by Howard Florey and Ernst Chain in Oxford by 1940.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.92,
            contradiction: 0.03,
            neutral: 0.05,
            evidence: { docId: 'KILT-WIKI-6102', title: 'Howard Florey', text: 'In 1940 Florey and Chain purified and extracted penicillin for clinical use at Oxford University.', bm25: 18.2 }
          }
        ],
        ragClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in 1928 at St. Mary’s Hospital.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Fleming discovered penicillin at St. Mary’s Hospital in 1928.', bm25: 22.4 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'Alexander Fleming discovered penicillin in 1935 after serving in the Royal Navy, winning the Nobel prize alone in 1941.',
        ragText: 'Alexander Fleming discovered penicillin in 1928, later sharing the 1945 Nobel Prize in Physiology or Medicine with Florey and Chain.',
        nonRagClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in 1935.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.06,
            contradiction: 0.91,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Penicillin was discovered in 1928, not 1935.', bm25: 19.5 }
          },
          {
            text: 'Fleming won the Nobel prize alone in 1941.',
            type: 'quantitative',
            verdict: 'refuted',
            entailment: 0.03,
            contradiction: 0.94,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Nobel Prize in Physiology or Medicine 1945', text: 'Fleming shared the 1945 Nobel Prize with Howard Florey and Ernst Chain.', bm25: 19.1 }
          }
        ],
        ragClaims: [
          {
            text: 'Alexander Fleming discovered penicillin in 1928.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Alexander Fleming', text: 'Fleming discovered penicillin in 1928.', bm25: 21.0 }
          },
          {
            text: 'He shared the 1945 Nobel Prize in Physiology or Medicine with Florey and Chain.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-4921', title: 'Nobel Prize 1945', text: 'The Nobel Prize in Physiology or Medicine 1945 was awarded jointly to Fleming, Chain, and Florey.', bm25: 20.2 }
          }
        ]
      }
    }
  },
  {
    id: 'BENCH-002',
    source: 'HaluEval',
    domain: 'history',
    difficulty: 'medium',
    question: 'Where was the Treaty of Versailles signed and what date did it take effect?',
    groundTruth: 'The Treaty of Versailles was signed on June 28, 1919 in the Hall of Mirrors at the Palace of Versailles, taking effect on January 10, 1920.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'The Treaty of Versailles was signed in the Hall of Mirrors at the Palace of Versailles on June 28, 1919, taking effect on January 10, 1920.',
        ragText: 'According to treaty documentation, the Treaty of Versailles was signed on June 28, 1919 at Versailles, France, and took legal effect on January 10, 1920.',
        nonRagClaims: [
          {
            text: 'The Treaty of Versailles was signed in the Hall of Mirrors at the Palace of Versailles.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'The treaty was signed on 28 June 1919 in the Hall of Mirrors in the Palace of Versailles.', bm25: 22.0 }
          },
          {
            text: 'The treaty was signed on June 28, 1919.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'It was signed on 28 June 1919, exactly five years after the assassination of Archduke Franz Ferdinand.', bm25: 21.5 }
          },
          {
            text: 'The treaty took effect on January 10, 1920.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.95,
            contradiction: 0.02,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Effective 10 January 1920, registering with the Secretariat of the League of Nations on 21 October 1919.', bm25: 19.8 }
          }
        ],
        ragClaims: [
          {
            text: 'The Treaty was signed on June 28, 1919 in Versailles.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed on 28 June 1919 at the Palace of Versailles.', bm25: 21.0 }
          },
          {
            text: 'The treaty took legal effect on January 10, 1920.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Effective date 10 January 1920.', bm25: 19.5 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'The Treaty of Versailles was signed in Berlin on November 11, 1918 by Woodrow Wilson and Kaiser Wilhelm II.',
        ragText: 'The Treaty of Versailles was formally signed in the Hall of Mirrors, Versailles on June 28, 1919, entering into force on January 10, 1920.',
        nonRagClaims: [
          {
            text: 'The Treaty of Versailles was signed in Berlin.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.96,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'The treaty was signed in the Hall of Mirrors in the Palace of Versailles near Paris, not in Berlin.', bm25: 23.4 }
          },
          {
            text: 'The Treaty was signed on November 11, 1918.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.04,
            contradiction: 0.93,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'November 11, 1918 was the Armistice of Compiègne. The Treaty of Versailles was signed later on June 28, 1919.', bm25: 20.1 }
          },
          {
            text: 'It was signed by Kaiser Wilhelm II.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.01,
            contradiction: 0.97,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Kaiser Wilhelm II', text: 'Kaiser Wilhelm II abdicated in November 1918 before the treaty was signed by representatives of the Weimar Republic.', bm25: 18.9 }
          }
        ],
        ragClaims: [
          {
            text: 'The Treaty of Versailles was signed in Versailles on June 28, 1919.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed 28 June 1919 at Versailles.', bm25: 22.0 }
          },
          {
            text: 'It entered into force on January 10, 1920.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.96,
            contradiction: 0.02,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Effective date 10 January 1920.', bm25: 19.0 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'The treaty was signed on June 28, 1919 at Versailles and came into effect on January 10, 1920 after ratification by the principal Allied powers.',
        ragText: 'Signed at the Palace of Versailles on June 28, 1919, the Treaty of Versailles became effective on January 10, 1920.',
        nonRagClaims: [
          {
            text: 'The treaty was signed on June 28, 1919 at Versailles.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed 28 June 1919 at Versailles.', bm25: 22.0 }
          },
          {
            text: 'The treaty came into effect on January 10, 1920.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Effective 10 January 1920.', bm25: 19.8 }
          }
        ],
        ragClaims: [
          {
            text: 'The treaty was signed on June 28, 1919 at Versailles.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed on 28 June 1919 at Versailles.', bm25: 22.0 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'The Treaty of Versailles was negotiated in London and signed on June 28, 1919, taking effect immediately in August 1919.',
        ragText: 'The Treaty of Versailles was signed on June 28, 1919 in France and entered into force on January 10, 1920.',
        nonRagClaims: [
          {
            text: 'The Treaty of Versailles was negotiated in London.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.04,
            contradiction: 0.92,
            neutral: 0.04,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Paris Peace Conference', text: 'Negotiations occurred at the Paris Peace Conference in Paris, not London.', bm25: 21.3 }
          },
          {
            text: 'The treaty was signed on June 28, 1919.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed 28 June 1919.', bm25: 20.0 }
          },
          {
            text: 'The treaty took effect in August 1919.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.05,
            contradiction: 0.89,
            neutral: 0.06,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'It took effect on 10 January 1920, not August 1919.', bm25: 19.5 }
          }
        ],
        ragClaims: [
          {
            text: 'The Treaty of Versailles was signed on June 28, 1919.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Signed 28 June 1919.', bm25: 21.0 }
          },
          {
            text: 'It entered into force on January 10, 1920.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-1049', title: 'Treaty of Versailles', text: 'Effective 10 January 1920.', bm25: 19.0 }
          }
        ]
      }
    }
  },
  {
    id: 'BENCH-003',
    source: 'TruthfulQA',
    domain: 'medicine',
    difficulty: 'hard',
    question: 'Does the MMR vaccine cause autism in children according to peer-reviewed epidemiological research?',
    groundTruth: 'No, exhaustive peer-reviewed scientific studies involving millions of children confirm that the MMR vaccine does not cause autism.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'Extensive scientific consensus from hundreds of peer-reviewed studies across millions of participants shows no causal link between the MMR vaccine and autism.',
        ragText: 'Epidemiological studies published in The Lancet, CDC, and WHO confirm no association between the MMR vaccine and autism spectrum disorders.',
        nonRagClaims: [
          {
            text: 'Extensive scientific studies show no causal link between MMR and autism.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine and Autism', text: 'Extensive scientific studies involving over a million children have repeatedly concluded there is no causal link between the MMR vaccine and autism.', bm25: 24.1 }
          }
        ],
        ragClaims: [
          {
            text: 'Epidemiological studies confirm no association between MMR vaccine and autism.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine and Autism', text: 'The Centers for Disease Control and Prevention and the World Health Organization have determined no link exists.', bm25: 23.5 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'Some 1998 medical studies in The Lancet proved the MMR vaccine directly causes gastrointestinal inflammation and autism in 30% of recipients.',
        ragText: 'The 1998 Wakefield paper was fully retracted for fraud, and extensive global studies have definitively disproven any connection between MMR and autism.',
        nonRagClaims: [
          {
            text: 'The 1998 Lancet study proved MMR causes autism in 30% of recipients.',
            type: 'quantitative',
            verdict: 'refuted',
            entailment: 0.01,
            contradiction: 0.98,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine and Autism', text: 'The 1998 paper by Andrew Wakefield was found to be fraudulent and retracted by The Lancet in 2010; no proof of causation or 30% prevalence exists.', bm25: 26.2 }
          },
          {
            text: 'MMR causes gastrointestinal inflammation leading to autism.',
            type: 'causal',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.96,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine and Autism', text: 'The hypothesized mechanism linking MMR vaccine, bowel inflammation, and autism was thoroughly debunked by multiple independent studies.', bm25: 22.8 }
          }
        ],
        ragClaims: [
          {
            text: 'The 1998 paper was retracted for fraud.',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-9321', title: 'Andrew Wakefield', text: 'The Lancet fully retracted the paper in February 2010 after the UK General Medical Council found Wakefield guilty of dishonesty and ethical violations.', bm25: 25.0 }
          },
          {
            text: 'Global studies have disproven any connection between MMR and autism.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine', text: 'Subsequent large-scale studies in millions of children proved no connection.', bm25: 23.1 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'No. Rigorous clinical and epidemiological evidence across global health organizations has consistently shown the MMR vaccine does not cause autism.',
        ragText: 'The overwhelming weight of epidemiological evidence demonstrates that the MMR vaccine does not increase the risk of autism.',
        nonRagClaims: [
          {
            text: 'Rigorous epidemiological evidence shows MMR does not cause autism.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine', text: 'No causal link between MMR and autism has been found across dozens of peer-reviewed studies.', bm25: 23.0 }
          }
        ],
        ragClaims: [
          {
            text: 'MMR vaccine does not increase the risk of autism.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine', text: 'Extensive studies show MMR does not increase risk of autism.', bm25: 22.7 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'While the MMR vaccine has been cleared by WHO, lingering studies from Cambridge in 2004 show an unknown elevated risk factor.',
        ragText: 'Global epidemiological studies, including nationwide cohort studies in Denmark and Japan, found no evidence of an elevated autism risk from MMR.',
        nonRagClaims: [
          {
            text: 'Cambridge studies in 2004 showed an elevated risk factor.',
            type: 'temporal_date',
            verdict: 'unknown',
            entailment: 0.15,
            contradiction: 0.20,
            neutral: 0.65,
            evidence: { docId: 'KILT-WIKI-9321', title: 'MMR Vaccine and Autism', text: 'No 2004 Cambridge study demonstrating an elevated risk factor exists in major biomedical indexers.', bm25: 14.1 }
          }
        ],
        ragClaims: [
          {
            text: 'Nationwide cohort studies in Denmark and Japan found no evidence of elevated risk.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-9321', title: 'Danish MMR Cohort Study', text: 'A Danish study of 657,461 children published in Annals of Internal Medicine reaffirmed that MMR vaccination does not increase autism risk.', bm25: 23.8 }
          }
        ]
      }
    }
  },
  {
    id: 'BENCH-004',
    source: 'KILT_Wikipedia',
    domain: 'computer_science',
    difficulty: 'medium',
    question: 'What is the worst-case time complexity of QuickSort, and why does it happen?',
    groundTruth: 'The worst-case time complexity of QuickSort is O(n^2), occurring when the chosen pivot consistently splits the array into unbalanced partitions of 0 and n-1 elements.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'QuickSort has a worst-case time complexity of O(n^2). This occurs when the pivot is always the smallest or largest element, creating partitions of size 0 and n-1.',
        ragText: 'Quicksort has an average time complexity of O(n log n) and a worst-case of O(n^2), which occurs with unbalanced pivot partitions.',
        nonRagClaims: [
          {
            text: 'QuickSort has a worst-case time complexity of O(n^2).',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'The worst-case running time of quicksort is O(n^2), which occurs when the partitioning routine divides a problem of size n into subproblems of size 0 and n-1.', bm25: 25.0 }
          },
          {
            text: 'Worst-case occurs when the pivot is the smallest or largest element.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'This happens if the input array is already sorted and the pivot selected is the first or last element.', bm25: 22.4 }
          }
        ],
        ragClaims: [
          {
            text: 'QuickSort worst-case time complexity is O(n^2).',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Worst-case performance is O(n^2).', bm25: 23.0 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'QuickSort is an in-place sort with a worst-case time complexity of O(n log n), guaranteed by Tony Hoare\'s 1961 heap allocation theorem.',
        ragText: 'Tony Hoare developed Quicksort in 1959; while its average time complexity is O(n log n), its worst-case is O(n^2) when partitions are unbalanced.',
        nonRagClaims: [
          {
            text: 'QuickSort has a guaranteed worst-case time complexity of O(n log n).',
            type: 'definitional',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.97,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Quicksort\'s worst case is quadratic O(n^2), not O(n log n). MergeSort and HeapSort guarantee O(n log n).', bm25: 24.5 }
          },
          {
            text: 'Tony Hoare proved this via a 1961 heap allocation theorem.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.01,
            contradiction: 0.96,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Tony Hoare', text: 'Tony Hoare developed Quicksort in 1959. No such "heap allocation theorem" exists for Quicksort.', bm25: 19.3 }
          }
        ],
        ragClaims: [
          {
            text: 'Tony Hoare developed Quicksort in 1959.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Quicksort is an algorithm developed in 1959 by British computer scientist Tony Hoare.', bm25: 23.0 }
          },
          {
            text: 'Quicksort worst case is O(n^2) with unbalanced partitions.',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Worst-case execution time is O(n^2).', bm25: 22.0 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'The worst case is O(n^2) when partitions are severely unbalanced, though randomized pivot selection mitigates this in practical implementations.',
        ragText: 'QuickSort exhibits O(n^2) worst-case time complexity, which occurs when pivot selection consistently produces 0 and n-1 partitions.',
        nonRagClaims: [
          {
            text: 'Worst-case of QuickSort is O(n^2).',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Worst-case performance is O(n^2).', bm25: 23.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Worst-case occurs when pivot selection produces 0 and n-1 partitions.',
            type: 'causal',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Produces 0 and n-1 partitions.', bm25: 22.0 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'QuickSort worst-case time is O(n log n) with median-of-three, but drops to O(2^n) exponential if implemented with standard recursion.',
        ragText: 'QuickSort worst case is O(n^2) time complexity, typically observed when the array is already sorted and an extreme pivot is picked.',
        nonRagClaims: [
          {
            text: 'QuickSort drops to O(2^n) exponential time with standard recursion.',
            type: 'definitional',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.97,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort Complexity', text: 'Quicksort recursion depth at worst is n, giving O(n^2) total comparisons, never exponential O(2^n).', bm25: 21.0 }
          }
        ],
        ragClaims: [
          {
            text: 'QuickSort worst case is O(n^2) time complexity.',
            type: 'definitional',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-5510', title: 'Quicksort', text: 'Worst-case performance is O(n^2).', bm25: 23.0 }
          }
        ]
      }
    }
  },
  {
    id: 'BENCH-005',
    source: 'FEVER',
    domain: 'geography',
    difficulty: 'easy',
    question: 'What is the capital of Australia and when was it selected?',
    groundTruth: 'Canberra is the capital of Australia, chosen in 1908 as a compromise between Sydney and Melbourne.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'Canberra is the capital of Australia. It was chosen as the site for the federal capital in 1908 as a compromise between Sydney and Melbourne.',
        ragText: 'Canberra was officially chosen as the federal capital of Australia in 1908 as a compromise between Melbourne and Sydney.',
        nonRagClaims: [
          {
            text: 'Canberra is the capital of Australia.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Canberra is the capital city of Australia.', bm25: 23.0 }
          },
          {
            text: 'It was selected in 1908.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'The site of Canberra was selected for the location of the nation\'s capital in 1908 as a compromise between Sydney and Melbourne.', bm25: 24.5 }
          }
        ],
        ragClaims: [
          {
            text: 'Canberra was chosen as the capital in 1908.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Canberra was chosen in 1908.', bm25: 24.0 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'Sydney is the capital of Australia, established in 1788 by Captain Arthur Phillip as the first seat of Commonwealth government.',
        ragText: 'Canberra was designated as Australia\'s national capital in 1908, resolving competition between Sydney and Melbourne.',
        nonRagClaims: [
          {
            text: 'Sydney is the capital of Australia.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.01,
            contradiction: 0.98,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Canberra is the capital of Australia. Sydney is the largest city and capital of New South Wales, not Australia.', bm25: 26.0 }
          },
          {
            text: 'Sydney was established in 1788 as the first seat of Commonwealth government.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.03,
            contradiction: 0.94,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Commonwealth of Australia', text: 'The Commonwealth of Australia was formed in 1901. In 1788 Sydney was founded as a British penal colony.', bm25: 21.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Canberra was designated as Australia\'s national capital in 1908.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Selected in 1908 as the national capital.', bm25: 23.5 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'Canberra is Australia\'s capital, selected in 1908 as a compromise between rival cities Sydney and Melbourne.',
        ragText: 'Canberra was selected as the capital city of Australia in 1908.',
        nonRagClaims: [
          {
            text: 'Canberra is Australia\'s capital.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Canberra is the capital city of Australia.', bm25: 23.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Canberra was selected as capital in 1908.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Selected in 1908.', bm25: 22.0 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'Melbourne was the permanent capital of Australia until 1927 when it was relocated to Brisbane.',
        ragText: 'Melbourne served as the temporary seat of government until Parliament House in Canberra was opened in 1927.',
        nonRagClaims: [
          {
            text: 'The capital was relocated to Brisbane in 1927.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.97,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Parliament relocated from Melbourne to Canberra in 1927, not Brisbane.', bm25: 23.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Parliament House in Canberra was opened in 1927.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-7811', title: 'Canberra', text: 'Parliament moved to Canberra on 9 May 1927 with the opening of the Provisional Parliament House.', bm25: 21.0 }
          }
        ]
      }
    }
  },
  {
    id: 'BENCH-006',
    source: 'HaluEval',
    domain: 'law_politics',
    difficulty: 'hard',
    question: 'When was the Universal Declaration of Human Rights adopted by the UN General Assembly and where?',
    groundTruth: 'The Universal Declaration of Human Rights was adopted on December 10, 1948 at the Palais de Chaillot in Paris, France.',
    modelVariants: {
      'gpt-4o': {
        nonRagText: 'The Universal Declaration of Human Rights was adopted by the United Nations General Assembly on December 10, 1948 at the Palais de Chaillot in Paris, France.',
        ragText: 'UN General Assembly Resolution 217 A was adopted on 10 December 1948 at the Palais de Chaillot, Paris.',
        nonRagClaims: [
          {
            text: 'The Declaration was adopted on December 10, 1948.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'The declaration was adopted by the UN General Assembly on 10 December 1948.', bm25: 24.0 }
          },
          {
            text: 'The adoption occurred at the Palais de Chaillot in Paris.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.98,
            contradiction: 0.01,
            neutral: 0.01,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Adopted at the Palais de Chaillot in Paris, France.', bm25: 22.0 }
          }
        ],
        ragClaims: [
          {
            text: 'The Declaration was adopted on 10 December 1948 in Paris.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Adopted on 10 December 1948 at Palais de Chaillot, Paris.', bm25: 23.0 }
          }
        ]
      },
      'llama-3-70b': {
        nonRagText: 'The Universal Declaration of Human Rights was signed in Geneva, Switzerland in October 1945 immediately after the conclusion of the Nuremberg Trials.',
        ragText: 'The UDHR was adopted on December 10, 1948 at the Palais de Chaillot in Paris, France with 48 countries voting in favor.',
        nonRagClaims: [
          {
            text: 'The Universal Declaration of Human Rights was signed in Geneva.',
            type: 'entity',
            verdict: 'refuted',
            entailment: 0.02,
            contradiction: 0.96,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'The declaration was adopted in Paris at the Palais de Chaillot, not Geneva.', bm25: 22.5 }
          },
          {
            text: 'It was signed in October 1945.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.03,
            contradiction: 0.95,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'It was adopted on 10 December 1948. October 1945 was the ratification of the UN Charter.', bm25: 21.0 }
          }
        ],
        ragClaims: [
          {
            text: 'The UDHR was adopted on December 10, 1948 in Paris.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Adopted 10 December 1948 at Palais de Chaillot in Paris.', bm25: 23.0 }
          },
          {
            text: '48 countries voted in favor of the declaration.',
            type: 'quantitative',
            verdict: 'supported',
            entailment: 0.96,
            contradiction: 0.02,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Of the 58 UN member states at the time, 48 voted in favor.', bm25: 20.0 }
          }
        ]
      },
      'claude-3-5-sonnet': {
        nonRagText: 'The Universal Declaration of Human Rights was proclaimed by the United Nations General Assembly in Paris on 10 December 1948.',
        ragText: 'Adopted in Paris on December 10, 1948, the UDHR set fundamental human rights to be universally protected.',
        nonRagClaims: [
          {
            text: 'Proclaimed in Paris on 10 December 1948.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Proclaimed by the United Nations General Assembly in Paris on 10 December 1948.', bm25: 24.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Adopted in Paris on December 10, 1948.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Adopted 10 December 1948.', bm25: 22.0 }
          }
        ]
      },
      'mistral-large': {
        nonRagText: 'The Universal Declaration was drafted by Eleanor Roosevelt and signed in San Francisco in June 1945 along with the UN Charter.',
        ragText: 'Eleanor Roosevelt chaired the UDHR drafting committee, which was adopted in Paris on December 10, 1948.',
        nonRagClaims: [
          {
            text: 'The Declaration was signed in San Francisco in June 1945.',
            type: 'temporal_date',
            verdict: 'refuted',
            entailment: 0.03,
            contradiction: 0.94,
            neutral: 0.03,
            evidence: { docId: 'KILT-WIKI-2209', title: 'San Francisco Conference', text: 'The UN Charter was signed in San Francisco in June 1945. The UDHR was adopted 3 years later in Paris on 10 December 1948.', bm25: 22.0 }
          },
          {
            text: 'Eleanor Roosevelt was involved in drafting.',
            type: 'entity',
            verdict: 'supported',
            entailment: 0.97,
            contradiction: 0.01,
            neutral: 0.02,
            evidence: { docId: 'KILT-WIKI-2209', title: 'Eleanor Roosevelt', text: 'Roosevelt was appointed head of the UN Human Rights Commission and played an instrumental role in drafting the UDHR.', bm25: 21.0 }
          }
        ],
        ragClaims: [
          {
            text: 'Adopted in Paris on December 10, 1948.',
            type: 'temporal_date',
            verdict: 'supported',
            entailment: 0.99,
            contradiction: 0.005,
            neutral: 0.005,
            evidence: { docId: 'KILT-WIKI-2209', title: 'UDHR', text: 'Adopted 10 December 1948.', bm25: 22.0 }
          }
        ]
      }
    }
  }
];
