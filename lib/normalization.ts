import { Unit } from "@/types";

const SYNONYMS: Record<string, string> = {
  tomate: "tomate",
  tomatinho: "tomate",
  banana: "banana",
  "banana prata": "banana",
  leite: "leite",
  "leite integral": "leite",
  arroz: "arroz",
  "arroz branco": "arroz",
  feijao: "feijão",
  "feijão": "feijão",
  cafe: "café",
  "café": "café",
  acucar: "açúcar",
  "açúcar": "açúcar",
  pao: "pão",
  "pão francês": "pão"
};

export function normalizeItemName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  return SYNONYMS[normalized] ?? normalized;
}

export function parsePackageFromTitle(title: string): { quantity: number; unit: Unit } | null {
  const lower = title.toLowerCase();
  const patterns: Array<{ regex: RegExp; unit: Unit }> = [
    { regex: /(\d+[\.,]?\d*)\s?(kg|quilo|quilos)\b/, unit: "kg" },
    { regex: /(\d+[\.,]?\d*)\s?(g|grama|gramas)\b/, unit: "g" },
    { regex: /(\d+[\.,]?\d*)\s?(l|litro|litros)\b/, unit: "l" },
    { regex: /(\d+[\.,]?\d*)\s?(ml|mililitro|mililitros)\b/, unit: "ml" }
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern.regex);
    if (match) {
      return {
        quantity: Number(match[1].replace(",", ".")),
        unit: pattern.unit
      };
    }
  }

  const bareUnitPatterns: Array<{ regex: RegExp; unit: Unit }> = [
    { regex: /\b(kg|quilo|quilos)\b/, unit: "kg" },
    { regex: /\b(g|grama|gramas)\b/, unit: "g" },
    { regex: /\b(l|litro|litros)\b/, unit: "l" },
    { regex: /\b(ml|mililitro|mililitros)\b/, unit: "ml" }
  ];

  for (const pattern of bareUnitPatterns) {
    if (pattern.regex.test(lower)) {
      return { quantity: 1, unit: pattern.unit };
    }
  }

  return { quantity: 1, unit: "un" };
}
