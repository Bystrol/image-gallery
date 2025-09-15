const { uploadToS3, generateUniqueFileName, isValidImageType } = require('../utils/s3Client');
const mimeTypes = require('mime-types');

/**
 * Parse multipart form data from Lambda event
 * @param {Object} event - Lambda event object
 * @returns {Object} - Parsed form data with files
 */
const parseMultipartFormData = (event) => {
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
  
  // Get content-type header (case insensitive)
  const contentType = event.headers['content-type'] || 
                     event.headers['Content-Type'] || 
                     event.headers['CONTENT-TYPE'] || '';
  
  if (!contentType) {
    throw new Error('Content-Type header is missing');
  }
  
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error('No boundary found in content-type header');
  }
  
  const boundary = boundaryMatch[1];

  const parts = body.toString('binary').split(`--${boundary}`);
  const files = [];
  
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    const [headers, ...bodyParts] = part.split('\r\n\r\n');
    const bodyContent = bodyParts.join('\r\n\r\n').slice(0, -2); // Remove trailing \r\n
    
    // Parse headers
    const headerLines = headers.split('\r\n');
    let contentDisposition = '';
    let contentType = 'application/octet-stream';
    
    headerLines.forEach(line => {
      if (line.toLowerCase().startsWith('content-disposition:')) {
        contentDisposition = line;
      } else if (line.toLowerCase().startsWith('content-type:')) {
        contentType = line.split(':')[1].trim();
      }
    });

    // Extract filename from content-disposition
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    const fieldNameMatch = contentDisposition.match(/name="([^"]+)"/);
    
    if (filenameMatch && fieldNameMatch && fieldNameMatch[1] === 'image') {
      files.push({
        filename: filenameMatch[1],
        contentType: contentType,
        buffer: Buffer.from(bodyContent, 'binary')
      });
    }
  }
  
  return { files };
};

/**
 * Create HTTP response with CORS headers
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body
 * @param {Object} additionalHeaders - Additional headers
 * @returns {Object} - Formatted Lambda response
 */
const createResponse = (statusCode, body, additionalHeaders = {}) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
};

/**
 * Validate uploaded file
 * @param {Object} file - File object with buffer, filename, and contentType
 * @returns {Object} - Validation result
 */
const validateFile = (file) => {
  const errors = [];
  
  // Check if file exists
  if (!file || !file.buffer || file.buffer.length === 0) {
    errors.push('No file provided or file is empty');
  }
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.buffer && file.buffer.length > maxSize) {
    errors.push(`File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
  }
  
  // Check if it's a valid image type
  if (file.contentType && !isValidImageType(file.contentType)) {
    errors.push(`Invalid file type: ${file.contentType}. Only image files are allowed.`);
  }
  
  // Validate filename
  if (!file.filename || file.filename.trim() === '') {
    errors.push('Filename is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Main Lambda handler for image upload
 * @param {Object} event - Lambda event object
 * @param {Object} context - Lambda context object
 * @returns {Object} - HTTP response
 */
exports.handler = async (event, context) => {
  console.log('Upload request received:', {
    httpMethod: event.httpMethod,
    contentType: event.headers['content-type'] || event.headers['Content-Type'] || 'none',
    bodySize: event.body ? event.body.length : 0,
    isBase64Encoded: event.isBase64Encoded,
    stage: process.env.STAGE
  });

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, { message: 'CORS preflight successful' });
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return createResponse(405, {
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    // Check if request has a body
    if (!event.body) {
      return createResponse(400, {
        error: 'Bad Request',
        message: 'Request body is required'
      });
    }

    // Check content type (case insensitive)
    const contentType = event.headers['content-type'] || 
                       event.headers['Content-Type'] || 
                       event.headers['CONTENT-TYPE'] || '';
    
    if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
      return createResponse(400, {
        error: 'Bad Request',
        message: 'Content-Type must be multipart/form-data',
        receivedContentType: contentType || 'none'
      });
    }

    // Parse multipart form data
    let parsedData;
    try {
      parsedData = parseMultipartFormData(event);
    } catch (parseError) {
      console.error('Error parsing multipart data:', parseError);
      return createResponse(400, {
        error: 'Bad Request',
        message: 'Failed to parse multipart form data',
        details: parseError.message
      });
    }

    // Check if files were uploaded
    if (!parsedData.files || parsedData.files.length === 0) {
      return createResponse(400, {
        error: 'Bad Request',
        message: 'No image file found in request. Please upload a file with field name "image"'
      });
    }

    const file = parsedData.files[0]; // Take the first file

    // Validate the file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return createResponse(400, {
        error: 'Validation Error',
        message: 'File validation failed',
        details: validation.errors
      });
    }

    // Detect content type if not provided or incorrect
    let finalContentType = file.contentType;
    if (!finalContentType || finalContentType === 'application/octet-stream') {
      finalContentType = mimeTypes.lookup(file.filename) || 'image/jpeg';
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFileName(file.filename);

    // Upload to S3
    console.log(`Uploading file: ${uniqueFilename} (${file.buffer.length} bytes)`);
    const uploadResult = await uploadToS3(file.buffer, uniqueFilename, finalContentType);

    console.log('Upload successful:', uploadResult);

    // Return success response
    return createResponse(200, {
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: uploadResult.url,
        filename: uniqueFilename,
        originalName: file.filename,
        size: file.buffer.length,
        contentType: finalContentType,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Handle specific S3 errors
    if (error.code === 'NoSuchBucket') {
      return createResponse(500, {
        error: 'Configuration Error',
        message: 'S3 bucket not found. Please check your configuration.'
      });
    }

    if (error.code === 'AccessDenied') {
      return createResponse(500, {
        error: 'Permission Error',
        message: 'Access denied to S3 bucket. Please check IAM permissions.'
      });
    }

    if (error.code === 'AccessControlListNotSupported') {
      return createResponse(500, {
        error: 'S3 Configuration Error',
        message: 'S3 bucket does not support ACLs. This has been fixed - please try again.'
      });
    }

    // Generic error response
    return createResponse(500, {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during upload',
      details: process.env.STAGE === 'dev' ? error.message : undefined
    });
  }
};
