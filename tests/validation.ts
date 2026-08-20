import {z} from 'zod';
const PaymentSchema = z.object({
    amount: z.number()
});
const TestData = PaymentSchema.safeParse({
    amount: "hundered"
});
console.log(TestData);