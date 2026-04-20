interface EligibilityInput {
  age: number;
  nationality: string;
  maritalStatus: string;
  dependents: number;
  education: string;
  educationField?: string;
  educationCountry?: string;
  englishProficiency?: string;
  frenchProficiency?: string;
  workExperienceYears: number;
  nocCode?: string;
  canadianExperience: number;
  funds: number;
  familyInCanada: boolean;
  jobOffer: boolean;
  provincialConnections?: string;
}

export const eligibilityPrompt = (input: EligibilityInput): string => {
  return `You are a senior Canadian immigration consultant with deep expertise in all Canadian immigration pathways.

TASK: Assess this applicant's eligibility for ALL Canadian immigration pathways and provide the top 3-5 most suitable programs.

APPLICANT PROFILE:
- Age: ${input.age}
- Nationality: ${input.nationality}
- Marital Status: ${input.maritalStatus}
- Dependents: ${input.dependents}
- Education: ${input.education} ${input.educationField ? `in ${input.educationField}` : ""} ${input.educationCountry ? `from ${input.educationCountry}` : ""}
- English: ${input.englishProficiency || "Not specified"}
- French: ${input.frenchProficiency || "Not specified"}
- Work Experience: ${input.workExperienceYears} years ${input.nocCode ? `(NOC: ${input.nocCode})` : ""}
- Canadian Experience: ${input.canadianExperience} years
- Available Funds: CAD $${input.funds.toLocaleString()}
- Family in Canada: ${input.familyInCanada ? "Yes" : "No"}
- Job Offer: ${input.jobOffer ? "Yes" : "No"}
- Provincial Connections: ${input.provincialConnections || "None"}

PATHWAYS TO EVALUATE:
1. Express Entry - Federal Skilled Worker (FSW)
2. Express Entry - Canadian Experience Class (CEC)
3. Express Entry - Federal Skilled Trades (FST)
4. Provincial Nominee Programs (PNP) - all provinces
5. Atlantic Immigration Program (AIP)
6. Rural and Northern Immigration Pilot
7. Start-Up Visa
8. Self-Employed Persons
9. Caregiver Programs
10. Study Permit → PGWP → PR pathway
11. Temporary Foreign Worker Program
12. International Mobility Program
13. Spousal/Family Sponsorship (if applicable)
14. Quebec Immigration Programs
15. Refugee/Humanitarian programs (if applicable)

FOR EACH RECOMMENDED PATHWAY, provide:
1. Program Name
2. Eligibility Confidence: X% (be realistic)
3. Requirements Met: [list]
4. Requirements NOT Met: [list]
5. Estimated Timeline to PR (if applicable)
6. Estimated CRS Score (if Express Entry)
7. Key Next Steps (2-3 specific actions)

Rank from highest to lowest eligibility confidence. Be honest about challenges. Format as structured sections.`;
};
