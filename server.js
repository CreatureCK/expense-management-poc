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
      const uploadDir = '/tmp/uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() *
  1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix +
  path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|pdf/;
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png',
  'application/pdf'];

      const extname =
  allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedMimeTypes.includes(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only .png, .jpg, .jpeg and .pdf files are 
  allowed!'));
      }
    }
  });

  // Simple OCR processing (placeholder)
  async function processOCR(filePath) {
    console.log('Processing OCR for file:', filePath);
    // For now, return mock data to test deployment
    return {
      total: 25.50,
      establishment: "Test Merchant",
      date: new Date().toLocaleDateString('en-GB')
    };
  }

  // Simple journal entry generation
  async function generateJournalEntry(ocrData) {
    console.log('Generating journal entry for:', ocrData);

    return {
      date: ocrData.date || new Date().toLocaleDateString('en-GB'),
      description: `${ocrData.establishment || 'Unknown Merchant'} - 
  Expense`,
      reference: "AUTO-GENERATED",
      merchant: ocrData.establishment || "Unknown Merchant",
      entries: [
        {
          type: "debit",
          account: "General Expenses",
          amount: ocrData.total || 0,
          description: "Expense transaction"
        },
        {
          type: "credit",
          account: "Cash/Bank Account",
          amount: ocrData.total || 0,
          description: "Payment"
        }
      ],
      vatBreakdown: {
        netAmount: ocrData.total || 0,
        vatAmount: 0,
        grossAmount: ocrData.total || 0,
        vatRate: 0
      },
      totalDebit: ocrData.total || 0,
      totalCredit: ocrData.total || 0
    };
  }

  // API Routes
  app.post('/api/upload', upload.single('receipt'), async (req, res) => {
    try {
      console.log('Upload request received');

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('File uploaded:', req.file.filename);

      // Process OCR (simplified for testing)
      const ocrData = await processOCR(req.file.path);
      console.log('OCR completed');

      // Generate journal entry
      const journalEntry = await generateJournalEntry(ocrData);
      console.log('Journal entry generated');

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

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
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      env: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasTabScanner: !!process.env.TABSCANNER_API_KEY
      }
    });
  });

  // Serve the main page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment check:');
    console.log('- OpenAI API Key:', !!process.env.OPENAI_API_KEY);
    console.log('- TabScanner API Key:', !!process.env.TABSCANNER_API_KEY);
  });
