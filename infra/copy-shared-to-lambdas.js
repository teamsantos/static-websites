#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lambda directories that need shared modules
const lambdas = [
  'lambda/payment-session',
  'lambda/stripe-webhook',
  'lambda/github-webhook',
  'lambda/health-check',
];

const sharedSrc = path.join(__dirname, '..', 'shared');

lambdas.forEach(lambdaDir => {
  const lambdaPath = path.join(__dirname, lambdaDir);
  const sharedDest = path.join(lambdaPath, 'shared');
  
  // Create shared directory in lambda if it doesn't exist
  if (!fs.existsSync(sharedDest)) {
    fs.mkdirSync(sharedDest, { recursive: true });
  }
  
  // Copy each shared module
  const sharedFiles = fs.readdirSync(sharedSrc).filter(f => f.endsWith('.js'));
  sharedFiles.forEach(file => {
    const src = path.join(sharedSrc, file);
    const dest = path.join(sharedDest, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to ${lambdaDir}/shared/`);
  });
});

console.log('Shared modules copied to all Lambda directories');
