import { z } from "zod";

export const sopSchema = z.object({
  applicationType: z.enum(["Study Permit", "Work Permit", "Visitor Visa", "PNP"]),
  name: z.string().min(2),
  age: z.number().min(16).max(80).optional(),
  nationality: z.string().min(2),
  education: z.string().min(2),
  program: z.string().optional(),
  institution: z.string().optional(),
  goals: z.string().min(10),
  tone: z.enum(["Formal", "Professional", "Conversational"]),
  notes: z.string().optional(),
});

export const crsSchema = z.object({
  age: z.number().min(18).max(65),
  education: z.string(),
  firstLanguage: z.object({
    speaking: z.number().min(0).max(12),
    listening: z.number().min(0).max(12),
    reading: z.number().min(0).max(12),
    writing: z.number().min(0).max(12),
  }),
  secondLanguage: z.object({
    speaking: z.number().min(0).max(12),
    listening: z.number().min(0).max(12),
    reading: z.number().min(0).max(12),
    writing: z.number().min(0).max(12),
  }).optional(),
  canadianWorkExperience: z.number().min(0).max(20),
  foreignWorkExperience: z.number().min(0).max(30),
  hasSpouse: z.boolean(),
  spouseEducation: z.string().optional(),
  spouseLanguage: z.object({
    speaking: z.number().min(0).max(12),
    listening: z.number().min(0).max(12),
    reading: z.number().min(0).max(12),
    writing: z.number().min(0).max(12),
  }).optional(),
  spouseCanadianExperience: z.number().optional(),
  provincialNomination: z.boolean(),
  jobOffer: z.boolean(),
  canadianEducation: z.boolean(),
  frenchAbility: z.boolean(),
  sibling: z.boolean(),
});

export const coverLetterSchema = z.object({
  applicationType: z.enum(["Work Permit", "Spousal Sponsorship", "PNP", "LMIA", "Visitor"]),
  name: z.string().min(2),
  nationality: z.string().min(2),
  currentStatus: z.string().optional(),
  position: z.string().optional(),
  employer: z.string().optional(),
  relationship: z.string().optional(),
  keyPoints: z.string().min(10),
  tone: z.enum(["Formal", "Professional", "Persuasive"]),
});

export const eligibilitySchema = z.object({
  age: z.number().min(16).max(80),
  nationality: z.string().min(2),
  maritalStatus: z.string(),
  dependents: z.number().min(0).max(20),
  education: z.string(),
  educationField: z.string().optional(),
  educationCountry: z.string().optional(),
  englishProficiency: z.string().optional(),
  frenchProficiency: z.string().optional(),
  workExperienceYears: z.number().min(0).max(40),
  nocCode: z.string().optional(),
  canadianExperience: z.number().min(0).max(20),
  funds: z.number().min(0),
  familyInCanada: z.boolean(),
  jobOffer: z.boolean(),
  provincialConnections: z.string().optional(),
});
