interface CoverLetterInput {
  applicationType: string;
  name: string;
  nationality: string;
  currentStatus?: string;
  position?: string;
  employer?: string;
  relationship?: string;
  keyPoints: string;
  tone: string;
}

export const coverLetterPrompt = (input: CoverLetterInput): string => {
  return `You are an expert Canadian immigration consultant specializing in writing professional cover letters for immigration applications.

TASK: Write a professional cover letter for the following application.

APPLICATION TYPE: ${input.applicationType}
APPLICANT: ${input.name}
NATIONALITY: ${input.nationality}
CURRENT STATUS: ${input.currentStatus || "Not specified"}
${input.position ? `POSITION/JOB: ${input.position}` : ""}
${input.employer ? `EMPLOYER: ${input.employer}` : ""}
${input.relationship ? `RELATIONSHIP: ${input.relationship}` : ""}
KEY POINTS TO HIGHLIGHT: ${input.keyPoints}
TONE: ${input.tone}

GUIDELINES BY APPLICATION TYPE:
${input.applicationType === "Work Permit" ? "- Address the employer's need and applicant's qualifications\n- Reference LMIA if applicable\n- Highlight relevant experience and skills" : ""}
${input.applicationType === "Spousal Sponsorship" ? "- Demonstrate genuine relationship\n- Include timeline of relationship\n- Show emotional connection and future plans" : ""}
${input.applicationType === "PNP" ? "- Reference specific provincial program\n- Demonstrate ties to the province\n- Show intent to settle and contribute" : ""}
${input.applicationType === "LMIA" ? "- Address to ESDC officer\n- Justify the need for foreign worker\n- Show recruitment efforts for Canadian workers" : ""}
${input.applicationType === "Visitor" ? "- State clear purpose of visit\n- Demonstrate ties to home country\n- Show financial capability and return plans" : ""}

FORMAT:
- Professional letter format with date, address block, salutation
- Addressed to: Visa Officer, Immigration, Refugees and Citizenship Canada
- 400-600 words
- ${input.tone} tone
- Do NOT fabricate facts. Use [specific detail] placeholders where needed.

Write the cover letter now:`;
};
