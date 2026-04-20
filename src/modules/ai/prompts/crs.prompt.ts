interface CRSInput {
  age: number;
  education: string;
  firstLanguage: {
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
  };
  secondLanguage?: {
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
  };
  canadianWorkExperience: number;
  foreignWorkExperience: number;
  hasSpouse: boolean;
  spouseEducation?: string;
  spouseLanguage?: {
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
  };
  spouseCanadianExperience?: number;
  provincialNomination: boolean;
  jobOffer: boolean;
  canadianEducation: boolean;
  frenchAbility: boolean;
  sibling: boolean;
}

// CRS Score calculation (pure math, no AI needed)
export const calculateCRS = (input: CRSInput) => {
  let sectionA = 0;
  let sectionB = 0;
  let sectionC = 0;
  let sectionD = 0;

  // Section A: Core/Human Capital
  // Age points (max 110 single, 100 married)
  const maxAge = input.hasSpouse ? 100 : 110;
  if (input.age >= 18 && input.age <= 35) sectionA += maxAge;
  else if (input.age === 36) sectionA += maxAge - 6;
  else if (input.age === 37) sectionA += maxAge - 12;
  else if (input.age === 38) sectionA += maxAge - 18;
  else if (input.age === 39) sectionA += maxAge - 24;
  else if (input.age === 40) sectionA += maxAge - 30;
  else if (input.age === 41) sectionA += maxAge - 36;
  else if (input.age === 42) sectionA += maxAge - 42;
  else if (input.age === 43) sectionA += maxAge - 48;
  else if (input.age === 44) sectionA += maxAge - 54;
  else if (input.age >= 45) sectionA += 0;

  // Education points (max 150 single, 140 married)
  const eduMap: Record<string, number[]> = {
    "phd": [150, 140],
    "masters": [135, 126],
    "two-or-more": [128, 119],
    "bachelors-3plus": [120, 112],
    "bachelors-2": [98, 91],
    "diploma-3plus": [90, 84],
    "diploma-1": [90, 84],
    "secondary": [30, 28],
    "none": [0, 0],
  };
  const eduPoints = eduMap[input.education] || [0, 0];
  sectionA += input.hasSpouse ? eduPoints[1] : eduPoints[0];

  // First language (simplified - max 136 single, 128 married per skill)
  const clbToPoints = (clb: number, single: boolean): number => {
    const max = single ? 34 : 32;
    if (clb >= 10) return max;
    if (clb === 9) return max - 4;
    if (clb === 8) return max - 10;
    if (clb === 7) return max - 18;
    if (clb <= 6) return 0;
    return 0;
  };

  const lang = input.firstLanguage;
  const isSingle = !input.hasSpouse;
  sectionA += clbToPoints(lang.speaking, isSingle);
  sectionA += clbToPoints(lang.listening, isSingle);
  sectionA += clbToPoints(lang.reading, isSingle);
  sectionA += clbToPoints(lang.writing, isSingle);

  // Canadian work experience (max 80 single, 70 married)
  const cwMap: Record<number, number[]> = {
    0: [0, 0], 1: [40, 35], 2: [53, 46], 3: [64, 56], 4: [72, 63], 5: [80, 70],
  };
  const cwYears = Math.min(input.canadianWorkExperience, 5);
  const cwPoints = cwMap[cwYears] || [80, 70];
  sectionA += input.hasSpouse ? cwPoints[1] : cwPoints[0];

  // Section B: Spouse factors (max 40 each)
  if (input.hasSpouse) {
    if (input.spouseEducation) {
      const spEduMap: Record<string, number> = {
        "phd": 10, "masters": 10, "bachelors-3plus": 9, "bachelors-2": 8,
        "diploma-3plus": 7, "diploma-1": 6, "secondary": 2, "none": 0,
      };
      sectionB += spEduMap[input.spouseEducation] || 0;
    }
    if (input.spouseLanguage) {
      const spLang = input.spouseLanguage;
      const spClb = (v: number) => (v >= 9 ? 5 : v >= 7 ? 3 : v >= 5 ? 1 : 0);
      sectionB += spClb(spLang.speaking) + spClb(spLang.listening) + spClb(spLang.reading) + spClb(spLang.writing);
    }
    if (input.spouseCanadianExperience && input.spouseCanadianExperience >= 1) {
      sectionB += Math.min(input.spouseCanadianExperience, 5) * 2;
    }
  }

  // Section C: Skill transferability (max 100)
  // Simplified calculation
  if (input.education !== "none" && input.education !== "secondary") {
    if (lang.speaking >= 9 || lang.listening >= 9) sectionC += 25;
    else if (lang.speaking >= 7) sectionC += 13;
  }
  if (input.foreignWorkExperience >= 3 && input.canadianWorkExperience >= 1) {
    sectionC += 25;
  } else if (input.foreignWorkExperience >= 1 && input.canadianWorkExperience >= 1) {
    sectionC += 13;
  }
  sectionC = Math.min(sectionC, 100);

  // Section D: Additional points (max 600)
  if (input.provincialNomination) sectionD += 600;
  if (input.jobOffer) sectionD += 50;
  if (input.canadianEducation) sectionD += 30;
  if (input.frenchAbility) sectionD += 25;
  if (input.sibling) sectionD += 15;

  const total = sectionA + sectionB + sectionC + sectionD;

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionD,
    total,
    breakdown: {
      "Core/Human Capital": sectionA,
      "Spouse Factors": sectionB,
      "Skill Transferability": sectionC,
      "Additional Points": sectionD,
    },
  };
};

export const crsOptimizerPrompt = (
  score: number,
  breakdown: Record<string, number>,
  input: CRSInput
): string => {
  return `You are a Canadian immigration expert specializing in Express Entry CRS optimization.

A client has a CRS score of ${score} with this breakdown:
${Object.entries(breakdown).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Client Profile:
- Age: ${input.age}
- Education: ${input.education}
- Canadian Work Experience: ${input.canadianWorkExperience} years
- Foreign Work Experience: ${input.foreignWorkExperience} years
- Has Spouse: ${input.hasSpouse}
- Provincial Nomination: ${input.provincialNomination}
- Job Offer: ${input.jobOffer}

Provide 5-7 specific, actionable recommendations to improve their CRS score. For EACH recommendation:
1. What to do (specific action)
2. Estimated point increase
3. Timeline to achieve
4. Difficulty level (Easy/Medium/Hard)

Recent Express Entry draws have had cutoffs around 470-520 for general draws. Format as a numbered list.`;
};
