const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting for API protection
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Apply rate limiting to all requests
app.use('/api/', limiter);

// Simple access control for partners (optional)
const ACCESS_CODE = process.env.ACCESS_CODE || null;

function checkAccess(req, res, next) {
  if (!ACCESS_CODE) {
    return next(); // No access control if no code set
  }
  
  const providedCode = req.headers['x-access-code'] || req.query.access_code;
  if (providedCode === ACCESS_CODE) {
    next();
  } else {
    res.status(401).json({ error: 'Access denied. Valid access code required.' });
  }
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Reduced to 5MB limit for public deployment
    files: 1, // Only allow 1 file
  },
  fileFilter: function (req, file, cb) {
    // Accept only jpg, png, and pdf files with strict validation
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    // Additional security checks
    if (file.originalname.includes('..') || file.originalname.includes('/')) {
      return cb(new Error('Invalid filename'));
    }

    if (mimetype && extname && file.size <= 5 * 1024 * 1024) {
      return cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg, .jpeg and .pdf files under 5MB are allowed!'));
    }
  }
});

// OCR processing with TabScanner API
async function processOCR(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    console.log('Sending request to TabScanner API...');
    const uploadResponse = await axios.post('https://api.tabscanner.com/api/2/process', form, {
      headers: {
        ...form.getHeaders(),
        'apikey': process.env.TABSCANNER_API_KEY,
      },
    });
    
    console.log('TabScanner Upload Response Status:', uploadResponse.status);
    console.log('TabScanner Upload Response Data:', JSON.stringify(uploadResponse.data, null, 2));
    
    // Check if we got a token for retrieving results
    if (uploadResponse.data && (uploadResponse.data.token || uploadResponse.data.duplicateToken)) {
      const token = uploadResponse.data.token || uploadResponse.data.duplicateToken;
      console.log('Got token from TabScanner:', token);
      
      // If this is a duplicate, the result might already be available
      if (uploadResponse.data.duplicate) {
        console.log('This is a duplicate image, results might be immediately available');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait
      } else {
        // Wait longer for fresh processing
        console.log('Waiting for TabScanner to process new image...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Try different endpoint patterns for retrieving results
      console.log('Retrieving results from TabScanner...');
      let resultResponse;
      
      // Try different possible endpoints and methods
      const endpointConfigs = [
        { method: 'GET', url: `https://api.tabscanner.com/api/result`, params: { token } },
        { method: 'GET', url: `https://api.tabscanner.com/api/2/result`, params: { token } },
        { method: 'GET', url: `https://api.tabscanner.com/api/result/${token}` },
        { method: 'GET', url: `https://api.tabscanner.com/result/${token}` },
        { method: 'POST', url: `https://api.tabscanner.com/api/result`, data: { token } },
        { method: 'POST', url: `https://api.tabscanner.com/api/2/result`, data: { token } }
      ];
      
      for (const config of endpointConfigs) {
        try {
          console.log(`Trying ${config.method} ${config.url}`);
          
          const requestConfig = {
            method: config.method,
            url: config.url,
            headers: {
              'apikey': process.env.TABSCANNER_API_KEY,
            }
          };
          
          if (config.params) {
            requestConfig.params = config.params;
          }
          if (config.data) {
            requestConfig.data = config.data;
          }
          
          resultResponse = await axios(requestConfig);
          console.log(`Success with ${config.method} ${config.url}`);
          break;
        } catch (endpointError) {
          console.log(`Failed with ${config.method} ${config.url}:`, endpointError.response?.status || endpointError.message);
          continue;
        }
      }
      
      if (!resultResponse) {
        throw new Error('Could not retrieve results from any TabScanner endpoint');
      }
      
      console.log('TabScanner Result Response Status:', resultResponse.status);
      console.log('TabScanner Result Response Data:', JSON.stringify(resultResponse.data, null, 2));
      
      // Check if the result contains OCR data
      if (resultResponse.data && resultResponse.data.result) {
        console.log('Found result data in TabScanner result response');
        return resultResponse.data.result;
      } else if (resultResponse.data && resultResponse.data.data) {
        console.log('Found data field in TabScanner result response');
        return resultResponse.data.data;
      } else {
        console.log('Using full TabScanner result response');
        return resultResponse.data;
      }
    } else {
      console.log('No token received from TabScanner, using upload response');
      return uploadResponse.data;
    }
    
  } catch (error) {
    console.error('TabScanner API error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw new Error('OCR processing failed');
  }
}

// Helper functions to extract data from OCR
function extractAmountFromOCR(ocrData) {
  try {
    console.log('Extracting amount from OCR data:', JSON.stringify(ocrData, null, 2));
    
    // Check for common TabScanner field names
    if (ocrData.total && typeof ocrData.total === 'number') {
      console.log('Found total field:', ocrData.total);
      return ocrData.total;
    }
    
    if (ocrData.totalAmount && typeof ocrData.totalAmount === 'number') {
      console.log('Found totalAmount field:', ocrData.totalAmount);
      return ocrData.totalAmount;
    }
    
    // Check for string amounts that need parsing
    if (ocrData.total && typeof ocrData.total === 'string') {
      const parsed = parseFloat(ocrData.total.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) {
        console.log('Parsed total from string:', parsed);
        return parsed;
      }
    }
    
    // Fallback: search through all data for numeric values
    const dataStr = JSON.stringify(ocrData).toLowerCase();
    const amountMatches = dataStr.match(/[\d,]+\.?\d{0,2}/g);
    if (amountMatches && amountMatches.length > 0) {
      const amounts = amountMatches.map(a => parseFloat(a.replace(/,/g, '')));
      const maxAmount = Math.max(...amounts);
      console.log('Found max amount from text search:', maxAmount);
      return maxAmount;
    }
  } catch (error) {
    console.log('Error extracting amount from OCR:', error.message);
  }
  
  console.log('Using fallback amount: 10.00');
  return 10.00; // Default fallback amount
}

function extractDateFromOCR(ocrData) {
  try {
    console.log('Extracting date from OCR data');
    
    // Check for common TabScanner date fields
    if (ocrData.date) {
      const date = new Date(ocrData.date);
      if (!isNaN(date)) {
        console.log('Found date field:', ocrData.date);
        return date.toLocaleDateString('en-GB');
      }
    }
    
    if (ocrData.purchaseDate) {
      const date = new Date(ocrData.purchaseDate);
      if (!isNaN(date)) {
        console.log('Found purchaseDate field:', ocrData.purchaseDate);
        return date.toLocaleDateString('en-GB');
      }
    }
    
    // Fallback: search through all data for date patterns
    const dataStr = JSON.stringify(ocrData);
    const dateMatches = dataStr.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g);
    if (dateMatches && dateMatches.length > 0) {
      const date = new Date(dateMatches[0]);
      if (!isNaN(date)) {
        console.log('Found date from text search:', dateMatches[0]);
        return date.toLocaleDateString('en-GB');
      }
    }
  } catch (error) {
    console.log('Error extracting date from OCR:', error.message);
  }
  
  console.log('No date found, using current date');
  return null;
}

function createFallbackJournalEntry(ocrData, amount, date) {
  // Check if VAT is explicitly mentioned in the OCR data
  const ocrText = JSON.stringify(ocrData).toLowerCase();
  const hasVAT = ocrText.includes('vat') || ocrText.includes('tax') || ocrText.includes('19%');
  
  let netAmount, vatAmount, vatRate;
  
  if (hasVAT) {
    // Only calculate VAT if explicitly mentioned
    netAmount = amount / 1.19; // Remove VAT
    vatAmount = amount - netAmount;
    vatRate = 0.19;
    console.log('VAT detected in receipt, calculating VAT breakdown');
  } else {
    // No VAT - total amount is the net amount
    netAmount = amount;
    vatAmount = 0;
    vatRate = 0;
    console.log('No VAT detected in receipt, treating total as net amount');
  }
  
  // Try to determine merchant and appropriate account from OCR data
  console.log('Extracting merchant from OCR data');
  let merchant = "Unknown Merchant";
  let expenseAccount = "General Expenses";
  let description = "Expense Transaction (OCR processed)";
  
  // Check for TabScanner specific merchant fields
  if (ocrData.establishment || ocrData.merchantName || ocrData.vendor) {
    merchant = ocrData.establishment || ocrData.merchantName || ocrData.vendor;
    console.log('Found merchant from structured field:', merchant);
  } else {
    // Try to extract merchant name (look for common patterns)
    const merchantPatterns = [
      /([A-Z][A-Z\s&]+[A-Z])/g,
      /"([^"]+)"/g,
      /^([A-Z][A-Za-z\s]+)/m
    ];
    
    for (const pattern of merchantPatterns) {
      const matches = JSON.stringify(ocrData).match(pattern);
      if (matches && matches[0] && matches[0].length > 3 && matches[0].length < 50) {
        merchant = matches[0].replace(/['"]/g, '').trim();
        console.log('Found merchant from pattern matching:', merchant);
        break;
      }
    }
  }
  
  // Simple merchant/account detection based on merchant name and OCR text
  const merchantLower = merchant.toLowerCase();
  if (merchantLower.includes('restaurant') || merchantLower.includes('cafe') || merchantLower.includes('food') || 
      ocrText.includes('restaurant') || ocrText.includes('cafe') || ocrText.includes('food')) {
    expenseAccount = "Meals & Entertainment";
    description = "Restaurant/Food expense";
  } else if (merchantLower.includes('gas') || merchantLower.includes('fuel') || merchantLower.includes('petrol') ||
             ocrText.includes('gas') || ocrText.includes('fuel') || ocrText.includes('petrol')) {
    expenseAccount = "Fuel & Transportation";
    description = "Fuel expense";
  } else if (merchantLower.includes('office') || merchantLower.includes('supplies') || merchantLower.includes('stationery') ||
             ocrText.includes('office') || ocrText.includes('supplies') || ocrText.includes('stationery')) {
    expenseAccount = "Office Supplies";
    description = "Office supplies";
  } else if (merchantLower.includes('hotel') || merchantLower.includes('accommodation') ||
             ocrText.includes('hotel') || ocrText.includes('accommodation')) {
    expenseAccount = "Travel & Accommodation";
    description = "Travel expense";
  } else if (merchantLower.includes('software') || merchantLower.includes('subscription') || merchantLower.includes('tech') ||
             ocrText.includes('software') || ocrText.includes('subscription') || ocrText.includes('tech')) {
    expenseAccount = "IT & Software";
    description = "Software/IT expense";
  }
  
  console.log('Determined merchant:', merchant, 'Account:', expenseAccount);
  
  // Build journal entries based on whether VAT is present
  const entries = [
    {
      type: "debit",
      account: expenseAccount,
      amount: parseFloat(netAmount.toFixed(2)),
      description: description
    }
  ];
  
  // Only add VAT entry if VAT is detected
  if (hasVAT && vatAmount > 0) {
    entries.push({
      type: "debit", 
      account: "VAT Input Tax",
      amount: parseFloat(vatAmount.toFixed(2)),
      description: `VAT ${(vatRate * 100).toFixed(0)}%`
    });
  }
  
  // Add credit entry
  entries.push({
    type: "credit",
    account: "Cash/Bank Account", 
    amount: parseFloat(amount.toFixed(2)),
    description: "Payment"
  });

  return {
    date: date,
    description: `${merchant} - ${description}`,
    reference: "AUTO-GENERATED",
    merchant: merchant,
    entries: entries,
    lineItems: [
      {
        description: description,
        quantity: 1,
        unitPrice: parseFloat(netAmount.toFixed(2)),
        total: parseFloat(netAmount.toFixed(2)),
        vatRate: vatRate,
        category: expenseAccount
      }
    ],
    vatBreakdown: {
      netAmount: parseFloat(netAmount.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      grossAmount: parseFloat(amount.toFixed(2)),
      vatRate: vatRate
    },
    totalDebit: parseFloat(amount.toFixed(2)),
    totalCredit: parseFloat(amount.toFixed(2))
  };
}

// Generate journal entries using OpenAI
async function generateJournalEntry(ocrData) {
  try {
    // Extract key info from OCR data for fallback
    const fallbackAmount = extractAmountFromOCR(ocrData);
    const fallbackDate = extractDateFromOCR(ocrData) || new Date().toLocaleDateString('en-GB');
    
    const prompt = `Analyze this receipt/invoice OCR data and return ONLY a JSON object (no other text) for a Cyprus accounting double-entry journal entry:

OCR Data: ${JSON.stringify(ocrData)}

ANALYSIS INSTRUCTIONS:
1. MERCHANT ANALYSIS: Identify the merchant/vendor name and determine appropriate expense accounts:
   - Restaurants/Cafes → "Meals & Entertainment" 
   - Gas Stations → "Fuel & Transportation"
   - Office Supply Stores → "Office Supplies"
   - Hotels → "Travel & Accommodation"
   - Supermarkets → "Office Refreshments" or "Staff Welfare"
   - Technology/Software → "IT & Software"
   - Professional Services → "Professional Fees"
   - Utilities → "Utilities"
   - Default → "General Expenses"

2. LINE ITEM ANALYSIS: Look for individual items/services to:
   - Identify different expense categories if multiple types
   - Look for explicit VAT/tax amounts or columns
   - Only include VAT if clearly shown as separate line item or column

3. VAT HANDLING: CRITICAL - Do NOT assume VAT exists:
   - ONLY include VAT if there's a separate VAT line item, tax column, or explicit VAT amount
   - If no VAT is shown, set vatAmount to 0.00 and vatRate to 0.00
   - Do NOT calculate or assume 19% VAT unless explicitly stated on receipt
   - Total amount = net amount when no VAT is present

4. ACCOUNT DETERMINATION: Based on merchant + line items, choose specific account names like:
   - "Meals & Entertainment", "Fuel Expenses", "Office Supplies"
   - "Professional Fees", "Software Subscriptions", "Travel Expenses"
   - Use specific accounts rather than generic "Expenses"

Requirements:
- Date format: DD/MM/YYYY  
- Currency: EUR
- Balanced debits and credits
- Multiple debit entries if different expense categories found
- ONLY include VAT entries if VAT is explicitly shown on receipt

Return exactly this JSON structure with no additional text:
{
  "date": "DD/MM/YYYY",
  "description": "Merchant name - Brief description",
  "reference": "Invoice/receipt number or N/A",
  "merchant": "Merchant/Vendor name",
  "entries": [
    {
      "type": "debit",
      "account": "Specific Expense Account Name",
      "amount": 0.00,
      "description": "Item/service description"
    },
    {
      "type": "debit",
      "account": "VAT Input Tax",
      "amount": 0.00,
      "description": "VAT (only if explicitly shown on receipt, otherwise 0.00)"
    },
    {
      "type": "credit", 
      "account": "Cash/Bank Account",
      "amount": 0.00,
      "description": "Payment method"
    }
  ],
  "lineItems": [
    {
      "description": "Item/service name",
      "quantity": 1,
      "unitPrice": 0.00,
      "total": 0.00,
      "vatRate": 0.00,
      "category": "Expense category"
    }
  ],
  "vatBreakdown": {
    "netAmount": 0.00,
    "vatAmount": 0.00,
    "grossAmount": 0.00,
    "vatRate": 0.00
  },
  "totalDebit": 0.00,
  "totalCredit": 0.00
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert accountant specializing in Cyprus accounting standards. You must respond with ONLY valid JSON, no additional text or formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
    });

    const response = completion.choices[0].message.content;
    console.log('Raw OpenAI response:', response);
    
    // Parse the JSON response with improved error handling
    let journalEntry;
    try {
      // First try direct parsing
      journalEntry = JSON.parse(response);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying to extract JSON...');
      
      // Remove markdown code blocks if present
      let cleanedResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      try {
        journalEntry = JSON.parse(cleanedResponse);
      } catch (secondParseError) {
        // Try to extract JSON object from text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            journalEntry = JSON.parse(jsonMatch[0]);
          } catch (thirdParseError) {
            console.error('All JSON parsing attempts failed');
            console.error('Original response:', response);
            console.error('Cleaned response:', cleanedResponse);
            throw new Error(`Invalid JSON response from OpenAI: ${thirdParseError.message}`);
          }
        } else {
          console.error('No JSON object found in response:', response);
          throw new Error('No valid JSON found in OpenAI response');
        }
      }
    }
    
    return journalEntry;
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    console.log('Falling back to basic journal entry generation...');
    
    // Create a fallback journal entry using extracted OCR data
    const fallbackAmount = extractAmountFromOCR(ocrData);
    const fallbackDate = extractDateFromOCR(ocrData) || new Date().toLocaleDateString('en-GB');
    
    return createFallbackJournalEntry(ocrData, fallbackAmount, fallbackDate);
  }
}

// API Routes
app.post('/api/upload', checkAccess, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    // Step 1: Process OCR
    console.log('Processing OCR...');
    const ocrData = await processOCR(filePath);
    
    // Step 2: Generate journal entry
    console.log('Generating journal entry...');
    const journalEntry = await generateJournalEntry(ocrData);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      ocrData: ocrData,
      journalEntry: journalEntry
    });
    
  } catch (error) {
    console.error('Processing error:', error.message);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: error.message || 'Processing failed'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to set TABSCANNER_API_KEY and OPENAI_API_KEY in your .env file');
});