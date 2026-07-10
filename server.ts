import express from 'express';
import {z} from 'zod';
import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg as any;
import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import cors from 'cors';
import {compileQA} from './ai-compiler.js'

if(!process.env.DATABASE_URL) {
    throw new Error("DATBASE_URL environment variable is not set.");
}
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});
const app = express();
const prisma = new PrismaClient({ adapter: adapter });
const redis = new Redis(process.env.REDIS_URL as string);

app.use(cors());
app.use(cors({
  origin: 'https://payment-engine-37fd.vercel.app' // Replace with your exact Vercel URL
}));

const paymentSchema = z.object({
    amount: z.number().int().positive(),
    idempotencyKey: z.string()
});
const refundSchema = z.object({
    originalTransactionId: z.string(),
    idempotencyKey: z.string()
});
const scenarioStepSchema = z.object({
    stepId: z.string().optional(),
    action: z.enum(["PAYMENT", "REFUND"]),
    mockResponse: z.object({
        httpStatus: z.number().int().min(100).max(599),
        body: z.any()
    })
});
const scenarioSchema = z.array(scenarioStepSchema);

app.use(express.json());
let currentStepIndex = 0;
let currentStepVolumeCount = 0;

app.post('/qa/compile', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).send({ error: "No prompt provided" });

    try {
        const rulebookJson = await compileQA(prompt, process.env.GROQ_API_KEY as string);
        await redis.set('active_qa_scenario', JSON.stringify(rulebookJson), 'EX', 600);
        currentStepIndex = 0;
        currentStepVolumeCount = 0;
        
        console.log(" AI Scenario compiled and loaded into Redis memory.");
        return res.status(200).send({ message: "Compiled successfully", rulebook: rulebookJson });
    } catch (error) {
        console.error("Groq compilation failed:", error);
        return res.status(500).send({ error: "AI Compilation Failed" });
    }
});

app.post('/payment', async (req, res) => {
    const incomingData = req.body;
    const parsedData = paymentSchema.safeParse(incomingData);
    if (!parsedData.success) {
        return res.status(400).send({error: parsedData.error});
    };
    
    const {amount, idempotencyKey} = parsedData.data;
    const lockAquired = await redis.set(idempotencyKey, 'locked', 'EX', 86400, 'NX');
    if (!lockAquired){
        return res.status(409).send({error: "Payment already in process."});
    }

    const rawScenario = await redis.get('active_qa_scenario');
    let mockResponseToSend = null; 

    if (rawScenario){
        const ruleBook = JSON.parse(rawScenario);
        
        if (currentStepIndex >= ruleBook.length) {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "No more steps in the rulebook."});
        }
        
        const currentStep = ruleBook[currentStepIndex];
        if (currentStep.action !== "PAYMENT") {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "Sequence mismatch"});
        }

        mockResponseToSend = currentStep.mockResponse;


        currentStepVolumeCount++; 

        if (currentStepVolumeCount >= currentStep.requestVolume) {
            currentStepIndex++;
            currentStepVolumeCount = 0;
        }
        if(mockResponseToSend.httpStatus >= 400){
            console.log(`Simulating failure for step ${currentStep.stepId}`);
            await redis.del(idempotencyKey);
            return res.status(mockResponseToSend.httpStatus).send(mockResponseToSend.body);
        }
    }
    
    console.log(`Charging card for Rs.${amount}`);
    try{
        await prisma.payment.create({
            data:{
                amount: amount,
                idempotencyKey: idempotencyKey
            }
        })
    } catch (error:any) {
        if (error.code === 'P2002') {
            return res.status(409).send({error: "Payment with this idempotency key already exists."});  
        }
        await redis.del(idempotencyKey); 
        console.error(`[500] Database error, releasing the key ${idempotencyKey}`, error.message);
        return res.status(500).send({error: "Internal Server Error"});
    }
    if (mockResponseToSend) {
        return res.status(mockResponseToSend.httpStatus).send(mockResponseToSend.body);
    } else {
        return res.status(200).send({ message: "Raw payment processed and saved to database successfully!" });
    }
});
app.post('/refund', async (req, res) => {
    const refundData = req.body;
    const refundParsedData = refundSchema.safeParse(refundData);
    if (!refundParsedData.success) {
        return res.status(400).send({error: refundParsedData.error});
    }

    const {originalTransactionId, idempotencyKey} = refundParsedData.data;
    
    const lockAquired = await redis.set(idempotencyKey, 'locked', 'EX', 86400, 'NX');
    if (!lockAquired){
        return res.status(409).send({error: "Refund already in process."});
    }

    const rawScenario = await redis.get('active_qa_scenario');
    let mockResponseToSend = null; // Store this early

    if (rawScenario) {
        const ruleBook = JSON.parse(rawScenario);
        if (currentStepIndex >= ruleBook.length) {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "No more steps in the rulebook."});
        }
        
        const currentStep = ruleBook[currentStepIndex];
        
        if (currentStep.action !== "REFUND") {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "Sequence mismatch"});
        }
        

        mockResponseToSend = currentStep.mockResponse;
        currentStepVolumeCount++; 
        

        if (currentStepVolumeCount >= currentStep.requestVolume) {
            currentStepIndex++;
            currentStepVolumeCount = 0;
        }

        if(mockResponseToSend.httpStatus >= 400){
            console.log(`Simulating failure for step ${currentStep.stepId}`);
            await redis.del(idempotencyKey);
            return res.status(mockResponseToSend.httpStatus).send(mockResponseToSend.body);
        }
    }

    console.log(`Processing refund for transaction ${originalTransactionId}`);
    try {
        await prisma.refund.create({
            data: {
                originalTransactionId,
                idempotencyKey
            }
        });
        
    } catch (error:any) {
        if (error.code === 'P2002') {
            return res.status(409).send({error: "Refund with this idempotency key already exists."});  
        }
        await redis.del(idempotencyKey);
        console.error(`[500] Database error, releasing the key ${idempotencyKey}`, error.message);
        return res.status(500).send({error: "Internal Server Error"});
    }

    if (mockResponseToSend) {
        return res.status(mockResponseToSend.httpStatus).send(mockResponseToSend.body);
    } else {
        return res.status(200).send({ message: "Raw refund processed successfully!" });
    }
});
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
})

