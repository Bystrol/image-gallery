const AWS = require('aws-sdk');

// Configure AWS SDK
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  // AWS credentials will be automatically picked up from:
  // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 2. IAM roles (when deployed to Lambda)
  // 3. AWS credentials file (~/.aws/credentials)
});

/**
 * Upload a file to S3 bucket
 * @param {Buffer} fileBuffer - The file content as a buffer
 * @param {string} fileName - The name to save the file as
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} - Upload result with file URL
 */
const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  const bucketName = process.env.BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is not set');
  }

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
    // Note: ACL removed as many S3 buckets have ACLs disabled
    // Public access is handled by bucket policy in serverless.yml
    // Optional: Add metadata
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'original-name': fileName
    }
  };

  try {
    const result = await s3.upload(params).promise();
    
    return {
      success: true,
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
      etag: result.ETag
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Generate a unique filename with timestamp and UUID
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename
 */
const generateUniqueFileName = (originalName) => {
  const { v4: uuidv4 } = require('uuid');
  const path = require('path');
  
  const timestamp = Date.now();
  const uuid = uuidv4();
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  
  // Create a unique filename: timestamp_uuid_originalname.ext
  return `${timestamp}_${uuid}_${baseName}${extension}`;
};

/**
 * Validate if the file is an image
 * @param {string} contentType - MIME type of the file
 * @returns {boolean} - True if it's an image
 */
const isValidImageType = (contentType) => {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml'
  ];
  
  return validTypes.includes(contentType.toLowerCase());
};

module.exports = {
  uploadToS3,
  generateUniqueFileName,
  isValidImageType,
  s3
};