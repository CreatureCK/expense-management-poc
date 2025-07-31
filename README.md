# Expense Management System - Proof of Concept

A web application for small business expense management that automatically processes receipt/invoice images using OCR and generates proper double-entry journal entries using AI.

## Features

- **File Upload**: Drag-and-drop interface for uploading receipts/invoices (JPG, PNG, PDF)
- **OCR Processing**: Automated text extraction using TabScanner API
- **AI-Powered Journal Entries**: Generates proper double-entry accounting entries using OpenAI
- **Cyprus Accounting Standards**: Configured for Cyprus VAT regulations (19% standard rate)
- **Professional UI**: Clean, responsive interface with loading states and error handling
- **Export Functionality**: Export journal entries to CSV format

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **OCR**: TabScanner API
- **AI**: OpenAI GPT-4
- **File Upload**: Multer middleware

## Prerequisites

- Node.js (v14 or higher)
- TabScanner API key ([Get one here](https://tabscanner.com/api))
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

1. **Clone or download the project**
   ```bash
   cd "Accounting Software Automation"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your API keys:
   ```
   TABSCANNER_API_KEY=your_tabscanner_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

4. **Start the application**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

1. **Upload a Receipt/Invoice**
   - Drag and drop a file onto the upload area, or
   - Click "browse files" to select a file
   - Supported formats: JPG, PNG, PDF (max 10MB)

2. **Processing**
   - The system will automatically:
     - Extract text using OCR (TabScanner API)
     - Analyze the content with AI (OpenAI GPT-4)
     - Generate a proper journal entry

3. **Review Results**
   - View the generated journal entry with:
     - Transaction details (date, description, reference)
     - Debit and credit entries
     - VAT breakdown (if applicable)
     - Balance verification

4. **Export**
   - Click "Export to CSV" to download the journal entry data

## Project Structure

```
├── server.js              # Express server with API endpoints
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── README.md              # This file
├── public/                # Frontend files
│   ├── index.html         # Main HTML page
│   ├── styles.css         # CSS styling
│   └── script.js          # JavaScript functionality
└── uploads/               # Temporary file storage (auto-created)
```

## API Endpoints

- `POST /api/upload` - Upload and process receipt/invoice
- `GET /api/health` - Health check endpoint
- `GET /` - Serve main application page

## Error Handling

The application includes comprehensive error handling for:
- Invalid file types or sizes
- API failures (TabScanner or OpenAI)
- Network connectivity issues
- Server errors

## Cyprus Accounting Configuration

The AI is configured with Cyprus-specific accounting knowledge:
- Standard VAT rate: 19%
- Date format: DD/MM/YYYY
- Currency: EUR
- Cyprus accounting standards compliance

## Security Considerations

- File upload validation (type and size limits)
- Temporary file cleanup after processing
- API key security through environment variables
- Input validation and sanitization

## Limitations

This is a proof of concept with the following limitations:
- No user authentication
- No data persistence
- Processing one file at a time
- Limited to Cyprus accounting standards
- Requires internet connection for API calls

## Development

To extend this application:

1. **Add Database**: Implement data persistence with PostgreSQL/MongoDB
2. **User Management**: Add authentication and user accounts
3. **Batch Processing**: Support multiple file uploads
4. **Accounting Integration**: Connect to accounting software APIs
5. **Enhanced AI**: Add more sophisticated business rules
6. **Multi-country Support**: Expand beyond Cyprus regulations

## Troubleshooting

### Common Issues

1. **"OCR processing failed"**
   - Check TabScanner API key
   - Verify file format and quality
   - Check network connectivity

2. **"Journal entry generation failed"**
   - Check OpenAI API key
   - Verify API quota/billing
   - Check network connectivity

3. **File upload errors**
   - Ensure file is under 10MB
   - Check file format (JPG, PNG, PDF only)
   - Verify uploads/ directory exists

### Debug Mode

Enable detailed logging by setting `NODE_ENV=development` in your `.env` file.

## License

This project is licensed under the MIT License - see the package.json file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Verify your API keys are correctly set
3. Ensure all dependencies are installed
4. Check the browser console for client-side errors
5. Check the server logs for backend errors