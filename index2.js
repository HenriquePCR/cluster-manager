const express = require("express");
const { createClient } = require("redis");
const { v4: uuidv4 } = require('uuid');

// Função para criar cliente Redis com configuração de Sentinel
async function connectToRedis() {
  let client;

  try {
    // Criar cliente Redis com configuração de Sentinel
    client = createClient({
      url: 'redis://127.0.0.1:6379', // Nome do container do Sentinel
      socket: {
        connectTimeout: 5000 // Timeout de conexão em milissegundos
      }
    });

    await client.connect();
    console.log(`Connected to Redis via Sentinel`);
  } catch (error) {
    console.error(`Failed to connect to Redis via Sentinel: ${error.message}`);
    throw new Error("Redis Sentinel is unavailable.");
  }

  return client;
}

// Função para desconectar do Redis
async function disconnectFromRedis(client) {
  try {
    if (client) {
      await client.quit();
      console.log("Disconnected from Redis");
    }
  } catch (error) {
    console.error("Error while disconnecting from Redis:", error.message);
  }
}

function generateRandomValue() {
  return Math.floor(Math.random() * 1000); // Valor aleatório entre 0 e 999
}

// Função para criar um servidor em uma porta específica
function createServer(port) {
  const app = express();

  app.get("/", async (req, res) => {
    let redisClient;

    try {
      // Conectar ao Redis para esta requisição
      redisClient = await connectToRedis();

      const uniqueKey = `Henrique:${uuidv4()}`;
      const randomValue = Math.floor(Math.random() * 1000).toString(); // Garante que o valor é uma string
      await redisClient.setEx(uniqueKey, 300, `Value: ${randomValue}, Stored in: Banco 2`);

      res.send(`Valor armazenado com chave ${uniqueKey}`);
    } catch (error) {
      console.error("Erro ao acessar o Redis:", error);
      res.status(500).send("Erro ao acessar o Redis");
    } finally {
      // Desconectar do Redis após a operação
      await disconnectFromRedis(redisClient);
    }
  });

  async function listAllKeysAndValues(client) {
    const keys = await client.keys("*"); // Obtém todas as chaves
    const values = await Promise.all(
      keys.map(async (key) => ({
        key,
        value: await client.get(key),
      }))
    );
    return values;
  }

  // Endpoint para listar todas as chaves e valores
  app.get("/list-keys", async (req, res) => {
    let redisClient;

    try {
      redisClient = await connectToRedis();
      const allData = await listAllKeysAndValues(redisClient);
      console.log('allData', allData);
      res.json(allData);
    } catch (error) {
      console.error("Erro ao acessar o Redis:", error);
      res.status(500).send("Erro ao acessar o Redis");
    } finally {
      await disconnectFromRedis(redisClient);
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Criar servidores em duas portas diferentes
createServer(3002);
