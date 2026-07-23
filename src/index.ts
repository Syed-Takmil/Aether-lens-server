




import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId, Db } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CORE DATABASE LAYER (NATIVE MONGODB DRIVER) ---
const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(mongoUrl);
let db: Db;

async function initializeSystemDatabase() {
  try {
    await client.connect();
    db = client.db('aetherlens');
    console.log(' System Online: Secure link established with native MongoDB driver.');
  } catch (err) {
    console.error(' System Fault: Database connection failed.', err);
    process.exit(1);
  }
}

// --- 2. AGENTIC AI CORE ENGINE (GEMINI) ---
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const aiAgentModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Note: updated to 1.5-flash as 3.5 doesn't exist yet!

// --- 3. OPERATIONAL LOGISTICS OPERATIONS (API ROUTES) ---

app.get('/api/suppliers', async (req: Request, res: Response): Promise<void> => {
  try {
    const profiles = await db.collection('suppliers').find({}).sort({ createdAt: -1 }).toArray();
    res.status(200).json(profiles);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/suppliers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await db.collection('suppliers').findOne({ _id: new ObjectId(req.params.id) });
    if (!record) {
      res.status(404).json({ success: false, message: 'Profile mismatch' });
      return;
    }
    res.status(200).json(record);
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Invalid identifier signature.' });
  }
});

app.post('/api/suppliers/add', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, shortDescription, fullDescription, category, riskRating, location, imageUrl } = req.body;
    
    const newSupplier = {
      title,
      shortDescription,
      fullDescription,
      category,
      riskRating: Number(riskRating) || 1,
      location,
      imageUrl: imageUrl || '',
      createdAt: new Date()
    };

    const result = await db.collection('suppliers').insertOne(newSupplier);
    res.status(201).json({ _id: result.insertedId, ...newSupplier });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/suppliers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('suppliers').deleteOne({ _id: new ObjectId(req.params.id as string) });
    res.status(200).json({ success: true, message: 'Supplier records purged successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// --- 4. REQUIREMENT 11-D: AI DATA ANALYZER COMPONENT ---
app.post('/api/agent/analyze-telemetry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dataPayload } = req.body;
    if (!dataPayload) {
      res.status(400).json({ message: 'Missing analytical operational telemetry logs.' });
      return;
    }

    const systemPrompt = `
      You are an expert AI Supply Chain Risk Agent. Review the following supplier log metrics:
      ${JSON.stringify(dataPayload, null, 2)}
      
      Generate a professional markdown report detailing:
      1. Trend Analysis (Risk shifts)
      2. Summary Reports (Stability parameters)
      3. Risk Identification & Clear action-item KPI Summaries.
      
      Provide clear details without standard conversational introduction lines.
    `;

    let textReport = "Supplier threat metrics evaluation temporarily queued.";

    // 🟩 FIXED: The robust 503 fallback logic is now safely inside the async route
    try {
      const result = await aiAgentModel.generateContent(systemPrompt);
      textReport = result.response.text();
    } catch (aiError: any) {
      console.error("⚠️ Gemini API Spike Encountered:", aiError.message || aiError);
      
      if (aiError.status === 503) {
        console.log("System Alert: Falling back to static audit metrics due to high Google API demand.");
        textReport = `### ⚠️ High API Demand\n\nAutomated AI assessment currently unavailable due to high network demand. Core telemetry for **${dataPayload.supplierName || 'node'}** parsed successfully.`;
      } else {
        throw aiError; // Re-throw if it's a critical code error
      }
    }
    
    res.status(200).json({ analysisReport: textReport });
  } catch (error: any) {
    console.error("Agent Evaluation Error:", error);
    res.status(500).json({ message: 'AI Agent evaluation error.', error: error.message });
  }
});

// --- 5. REQUIREMENT 11-E: AI AUTO CLASSIFICATION & TAGGING ENGINE ---
app.post('/api/agent/auto-classify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullDescription } = req.body;
    if (!fullDescription || fullDescription.length < 10) {
      res.status(400).json({ message: 'Provide a longer description for context matching.' });
      return;
    }

    const classificationPrompt = `
      You are an elite Industrial Supply Chain Categorization Agent. 
      Analyze this company operational description: "${fullDescription}"
      
      Determine the single best category out of these options:
      - Electronics
      - Raw Materials
      - Logistical Services
      - Energy & Infrastructure
      - Chemical Processing
      
      Also generate 3 relevant search tags starting with hashtags (e.g., #Aerospace, #Lithium, #HighRisk).
      
      Respond strictly in the following JSON format. Do not write anything else.
      {
        "suggestedCategory": "Selected Category Name Here",
        "generatedTags": ["#tag1", "#tag2", "#tag3"]
      }
    `;

    const result = await aiAgentModel.generateContent(classificationPrompt);
    const rawText = result.response.text().trim();
    
    const cleanJsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const classificationData = JSON.parse(cleanJsonString);

    res.status(200).json(classificationData);
  } catch (error: any) {
    console.error("Classification Engine Error:", error);
    res.status(500).json({ 
      suggestedCategory: "Raw Materials", 
      generatedTags: ["#VulnerabilityChecked", "#Logistics"] 
    });
  }
});

// --- 6. INITIALIZE SERVER FRAMEWORK ---
const PORT = process.env.PORT || 5000;

initializeSystemDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Single-File Engine running cleanly on port ${PORT}`);
  });
});