FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    unzip \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Vite globally
RUN npm install -g vite

# Install AWS CLI v2
RUN curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
  && unzip awscliv2.zip \
  && ./aws/install \
  && rm -rf awscliv2.zip aws

# Verify AWS CLI installation
RUN aws --version
