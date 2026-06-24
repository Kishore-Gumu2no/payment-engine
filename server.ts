import express from 'express';
import fs from 'fs';
import {z} from 'zod';
import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg as any;
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';


if(!process.env.DATABASE_URL) {
    throw new Error("DATBASE_URL environment variable is not set.");
}
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});
const app = express();
const prisma = new PrismaClient({ adapter: adapter });
const redis = new Redis();

const paymentSchema = z.object({
    amount: z.number().int().positive(),
    idempotencyKey: z.string()
});
const refundSchema = z.object({
    originalTransactionId: z.string(),
    idempotencyKey: z.string()
});

app.use(express.json());
console.log("Loading rulebook from file...");
const ruleBookData = fs.readFileSync('./rulebook.json', 'utf-8');
const parsedData = JSON.parse(ruleBookData);
const ruleBook = parsedData.RuleBook;
let currentStepIndex = 0;

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
    if (process.env.AI_TESTING === "true") {
        if (currentStepIndex >= ruleBook.length) {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "No more steps in the rulebook."});
        }
        const currentStep = ruleBook[currentStepIndex];
        if (currentStep.action !== "PAYMENT") {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "Sequence mismatch"});
        }
        currentStepIndex++;
        if(currentStep.mockResponse.httpStatus >= 400){
            console.log(`Simulating failure for step ${currentStep.stepId}`);
            await redis.del(idempotencyKey);
            return res.status(currentStep.mockResponse.httpStatus).send(currentStep.mockResponse.body);
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
        console.error(`[500] Database error, releasing the key ${idempotencyKey} for retry. `);
        return res.status(500).send({error: "Internal Server Error"});
    }
    if (process.env.AI_TESTING === "true") {
        const currentStep = ruleBook[currentStepIndex - 1]; 
        return res.status(currentStep.mockResponse.httpStatus).send(currentStep.mockResponse.body);
    } else {
        return res.status(200).send({ message: "Raw payment saved to database successfully!" });
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
    if (process.env.AI_TESTING === "true") {
        if (currentStepIndex >= ruleBook.length) {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "No more steps in the rulebook."});
        }
        const currentStep = ruleBook[currentStepIndex];
        if (currentStep.action !== "REFUND") {
            await redis.del(idempotencyKey);
            return res.status(400).send({error: "Sequence mismatch"});
        }
        currentStepIndex++;
        if(currentStep.mockResponse.httpStatus >= 400){
            console.log(`Simulating failure for step ${currentStep.stepId}`);
            await redis.del(idempotencyKey);
            return res.status(currentStep.mockResponse.httpStatus).send(currentStep.mockResponse.body);
        }
        console.log(`Processing refund for transaction ${originalTransactionId}`);
        await redis.del(idempotencyKey);
        console.error(`[500] Database error, lock released for key: ${idempotencyKey}`);
    }
    if (process.env.AI_TESTING === "true") {
        const currentStep = ruleBook[currentStepIndex - 1]; 
        return res.status(currentStep.mockResponse.httpStatus).send(currentStep.mockResponse.body);
    } else {
        return res.status(200).send({ message: "Raw refund processed successfully!" });
    }
})
app.listen(3000, () => {
    console.log("Server is listening on port 3000");
});

