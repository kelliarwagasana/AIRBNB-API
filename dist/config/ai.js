import { ChatGroq } from "@langchain/groq";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
}
const MODEL_NAME = "llama-3.3-70b-versatile";
export const llm = new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: MODEL_NAME,
    temperature: 0.7,
});
export const aiSearchModel = new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: MODEL_NAME,
    temperature: 0,
});
export const listingSearchFilterSchema = {
    type: "object",
    properties: {
        location: {
            type: ["string", "null"],
        },
        type: {
            type: ["string", "null"],
            enum: ["APARTMENT", "HOUSE", "VILLA", "CABIN", null],
        },
        maxPrice: {
            type: ["number", "null"],
        },
        guests: {
            type: ["number", "null"],
        },
    },
    required: ["location", "type", "maxPrice", "guests"],
    additionalProperties: false,
};
export default llm;
