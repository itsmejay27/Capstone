import { extractFileText } from './tosParser';

/**
 * Helpers shared by the AI generators: reading attached files and the
 * wording that steers question difficulty.
 */

/** Extracts plain text from uploaded files (PDF, DOCX, XLSX and text). */
export async function extractFilesContent(files: (File | null)[]): Promise<string> {
  const textParts: string[] = [];

  for (const file of files) {
    if (!file) continue;
    try {
      const content = await extractFileText(file);
      if (content.trim()) {
        textParts.push(`--- Attached Document (${file.name}) ---\n${content.substring(0, 4000)}`);
      } else {
        textParts.push(`--- Attached File (${file.name}, ${(file.size / 1024).toFixed(1)} KB) ---`);
      }
    } catch (err) {
      console.warn(`Error reading file ${file.name}:`, err);
    }
  }

  return textParts.join('\n\n');
}

export interface DifficultyDirective {
  levelLabel: string;
  instructions: string;
  stemLengthRule: string;
}

export function getDifficultyPromptDirective(difficulty: string): DifficultyDirective {
  const diff = (difficulty || 'medium').toLowerCase();

  if (diff === 'hard') {
    return {
      levelLabel: 'HARD / SYNTHESIS & EVALUATION (Bloom\'s Higher-Order Thinking)',
      instructions: `CRITICAL INSTRUCTION - ALL QUESTIONS MUST BE ACADEMICALLY RIGOROUS, HIGH DIFFICULTY, AND COGNITIVELY CHALLENGING:
- Use scenario-based problems, real-world case studies, edge cases, subtle bug diagnostics, multi-step reasoning, or architectural trade-offs.
- STRICTLY FORBIDDEN: Do NOT generate trivial recall, simple definitions, or basic terminology questions (e.g., avoid "What does X stand for?" or "What year was Y born?").
- Multiple Choice questions MUST have 4 plausible, nuanced choices where distractors represent common misconceptions or subtle errors that require deep understanding to reject.
- Short Answer / Essay questions must require critical evaluation, comparative analysis, and justification of methods.`,
      stemLengthRule: `Question stems must be detailed and contextual (20 to 50 words). Choices must be substantial phrases or complete concepts (not simple one-word answers).`,
    };
  }

  if (diff === 'easy') {
    return {
      levelLabel: 'EASY / KNOWLEDGE & RECALL (Bloom\'s Foundational Level)',
      instructions: `Questions should focus on fundamental terminology, core definitions, basic concepts, and direct factual recall.
- Ensure stems are clear, direct, and unambiguous.
- Distractors should be distinct and easily identifiable for someone who studied the basics.`,
      stemLengthRule: `Keep question stems direct and straightforward (10 to 20 words). Choices should be clear and concise.`,
    };
  }

  if (diff === 'mixed') {
    return {
      levelLabel: 'MIXED PROPORTIONAL (Bloom\'s Full Spectrum: 30% Recall, 40% Application, 30% Synthesis)',
      instructions: `Distribute question complexity across cognitive levels:
- Include foundational knowledge items, procedural application items, and advanced analytical scenario items.
- Ensure higher-numbered items feature realistic multi-step problem solving.`,
      stemLengthRule: `Vary question stems from concise conceptual queries to multi-line scenario problems.`,
    };
  }

  // Default: medium
  return {
    levelLabel: 'MEDIUM / APPLICATION & ANALYSIS (Bloom\'s Intermediate Level)',
    instructions: `Questions should focus on practical application of principles, analyzing relationships, comparing methods, and predicting procedural outcomes.
- Avoid both overly trivial recall questions and excessively arcane edge cases.
- Emphasize practical understanding, realistic use cases, and distinguishing between similar concepts.`,
    stemLengthRule: `Stems should provide sufficient context (15 to 35 words). Choices should represent realistic alternatives.`,
  };
}
