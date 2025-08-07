FROM node:20-alpine

RUN apk add --no-cache bash curl unzip git python3 make g++ \
  && npm install -g vite \
  && curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
  && unzip awscliv2.zip && ./aws/install \
  && rm -rf awscliv2.zip aws
