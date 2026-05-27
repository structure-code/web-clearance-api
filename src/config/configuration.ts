export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  emailFrom: process.env.EMAIL_FROM || 'Web Clearance <noreply@workfromanywhere.name.ng>',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3BucketName: process.env.AWS_S3_BUCKET_NAME,
  },
});
