FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expose the API port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
