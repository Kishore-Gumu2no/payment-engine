import {z} from "zod";
import {zodToJsonSchema} from "zod-to-json-schema";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const PaymentStepSchema = z.object(
    {
        stepId: z.string(),
        action: z.literal("PAYMENT"),
        amount: z.number().int().positive().describe("The amount of transaction will be 100 in default if the user doesn't specify otherwise"),
        requestVolume: z.number().int().positive(),
        executionStrategy: z.enum(["Sequential", "Concurrent Attack"]),
        mockResponse: z.object({
            httpStatus: z.number().min(100).max(599),
            body: z.object({ message: z.string() })
        })
    }
);
const RefundStepSchema = z.object(
    {
        stepId: z.string(),
        action: z.literal("REFUND"),
        originalTransactionId: z.string().describe("The ID of the original payment transaction being refunded."),
        requestVolume: z.number().int().positive(),
        executionStrategy: z.enum(["Sequential", "Concurrent Attack"]),
        mockResponse: z.object({
            httpStatus: z.number().min(100).max(599),
            body: z.object({ message: z.string() })
        })
    }
);
const ScenarioStepSchema = z.discriminatedUnion("action", [PaymentStepSchema, RefundStepSchema]);
export const ScenarioRuleBookSchema = z.array(ScenarioStepSchema);
const rulebookJsonSchema = zodToJsonSchema(ScenarioRuleBookSchema, "RuleBook");

export async function compileQA(scenarioDescription: string, apiKey: string) {
    const groq = new Groq({ 
        apiKey: process.env.GROQ_API_KEY 
    });
    console.log(`Compiling scenario description: ${scenarioDescription}`);
    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `You are a strict financial QA compiler. Your ONLY job is to extract the testing intent from the user's text and translate it into a valid JSON array.
                
                CRITICAL RULES:
                1. The user might ask a question, tell a story, or give a direct command. IGNORE the conversational tone. Extract ONLY the testing sequence.
                2. If the user mentions "attack", "simultaneous", "twice", "continuously", or doing something multiple times at once, set executionStrategy to "Concurrent Attack". Otherwise, use "Sequential".
                3. ONLY output raw JSON. NO markdown, NO greetings, NO explanations.
                4. The JSON MUST exactly match this Schema:
                ${JSON.stringify(rulebookJsonSchema)}

                EXAMPLES:
                User: "What happens if I click payment twice?"
                Output: { "RuleBook": [{ "stepId": "1", "action": "PAYMENT", "amount": 100, "requestVolume": 2, "executionStrategy": "Concurrent Attack", "mockResponse": { "httpStatus": 200, "body": { "message": "Success" } } }] }

                User: "I clicked the payment button continuously for 30 times"
                Output: { "RuleBook": [{ "stepId": "1", "action": "PAYMENT", "amount": 100, "requestVolume": 30, "executionStrategy": "Concurrent Attack", "mockResponse": { "httpStatus": 200, "body": { "message": "Success" } } }] }`

            },
            {
                role: "user",
                content: scenarioDescription
            }
        ],
        response_format: {type: "json_object"},
        temperature: 0,
    });
    const result = response.choices[0]?.message?.content;
    console.log(`=====INITIATING FIREWALL=====`);
    try{
        const rawJSON = JSON.parse(result!);
        let arrayToValidate;
        if (Array.isArray(rawJSON)){
            arrayToValidate = rawJSON
        }else{
            const foundArray = Object.values(rawJSON).find(val => Array.isArray(val));
            if (!foundArray){
                throw new Error("AI did not generate an array of steps");
            }
            arrayToValidate = foundArray
        }
        const validatedData = ScenarioRuleBookSchema.parse(arrayToValidate);
        console.log(`=====FIREWALL PASSED=====!`);
        return validatedData;
        }
    catch(error:any){
        console.error("FIREWALL BLOCKED THE DATA! The AI hallucinated.", error);
        throw error
    }
}

