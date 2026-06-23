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
        amount: z.number().int().positive(),
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
        originalTransactionId: z.string(),
        mockResponse: z.object({
            httpStatus: z.number().min(100).max(599),
            body: z.object({ message: z.string() })
        })
    }
);
const ScenarioStepSchema = z.discriminatedUnion("action", [PaymentStepSchema, RefundStepSchema]);
const ScenarioRuleBookSchema = z.array(ScenarioStepSchema);
const FinalSchema = z.object({RuleBook: ScenarioRuleBookSchema});
const rulebookJsonSchema = zodToJsonSchema(ScenarioRuleBookSchema, "RuleBook");
console.log(JSON.stringify(rulebookJsonSchema, null, 2));
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
async function compileStateMachine(scenarioDescription: string) {
    console.log(`Compiling scenario description: ${scenarioDescription}`);
    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `You are a strict financial QA compiler. 
                You must translate the user's scenario into a valid JSON object.
                The JSON MUST exactly match this JSON Schema. 
                Do not output markdown, do not output explanations, ONLY output raw JSON.
                
                Schema:
                ${JSON.stringify(rulebookJsonSchema)}`
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
    console.log(`=====AI COMPILED RULE BOOK=====`);
    console.log(result);
    console.log(`=====INITIATING FIREWALL=====`);
    try{
        const rawJSON = JSON.parse(result!);
        const validatedData = FinalSchema.parse(rawJSON);
        console.log(`=====FIREWALL PASSED=====!`);
        console.log(`The AI data is valid and follows the schema, now it can be used for testing`);
        const exportPath = "./rulebook.json";
        fs.writeFileSync(exportPath, JSON.stringify(validatedData, null, 2));
        console.log(`Rulebook saved to ${exportPath}`);
        }
    catch(error:any){
        console.error("FIREWALL BLOCKED THE DATA! The AI hallucinated.", error);
    }
}
const userScenario = process.argv[2];
if (!userScenario) {
    console.error("Please enter a valid scenario description");
    console.error('Example: npx ts-node ai-compiler.ts "The user pays, it fails, then succeeds"');
    process.exit(1);
}
compileStateMachine(userScenario);
