'use server';

/**
 * @fileOverview Generates exam questions based on a topic and difficulty level.
 *
 * - generateExamQuestions - A function that generates exam questions.
 * - GenerateExamQuestionsInput - The input type for the generateExamQuestions function.
 * - GenerateExamQuestionsOutput - The return type for the generateExamQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateExamQuestionsInputSchema = z.object({
  topic: z.string().describe('The topic of the exam questions.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the exam questions.'),
  numQuestions: z.number().int().min(1).max(10).default(5).describe('The number of questions to generate (1-10).'),
});
export type GenerateExamQuestionsInput = z.infer<typeof GenerateExamQuestionsInputSchema>;

const GenerateExamQuestionsOutputSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('The possible answers to the question.'),
      correctOption: z.number().int().min(0).describe('The index of the correct answer in the options array.'),
    })
  ).describe('An array of exam questions.'),
});
export type GenerateExamQuestionsOutput = z.infer<typeof GenerateExamQuestionsOutputSchema>;

export async function generateExamQuestions(input: GenerateExamQuestionsInput): Promise<GenerateExamQuestionsOutput> {
  return generateExamQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateExamQuestionsPrompt',
  input: {schema: GenerateExamQuestionsInputSchema},
  prompt: `You are an expert in generating exam questions.
  Generate {{numQuestions}} exam questions on the topic of {{{topic}}} with a difficulty level of {{{difficulty}}}.
  Each question should have 4 possible answers, and you should indicate the correct answer by setting the correctOption field to the index of the correct answer in the options array.
  The output should be a JSON object with a single key "questions" which is an array of question objects. Do not include any other text or explanation in your response, only the valid JSON object.
  Make sure each question object has the 'text', 'options' and 'correctOption' keys.
  Ensure that the correct option is realistic and plausible. Do not make it obvious or easily distinguishable from the incorrect options.
  The options should be distinct from each other and must not be near duplicates of one another.
  `, 
});

const generateExamQuestionsFlow = ai.defineFlow(
  {
    name: 'generateExamQuestionsFlow',
    inputSchema: GenerateExamQuestionsInputSchema,
    outputSchema: GenerateExamQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI did not return a response.');
    }
    try {
      return JSON.parse(output as string);
    } catch(e) {
      console.error("Failed to parse AI response as JSON", output);
      throw new Error("The AI returned an invalid response. Please try again.");
    }
  }
);
