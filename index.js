/*

curl http://localhost:3002/list-keys
curl http://localhost:3002

for i in {1..50}; do
    curl http://localhost:3002
    sleep 1
done

*/

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Redis = require("ioredis");

const servers = [
  { host: '172.21.12.56', port: 6379, name: 'redis-master' }, // Exemplo do master
  { host: '172.21.12.56', port: 6380, name: 'redis-slave1' }, // Exemplo do slave 1
  { host: '172.21.12.56', port: 6381, name: 'redis-slave2' }  // Exemplo do slave 2
];

async function getMaster(servers) {
  for (const server of servers) {
    let client;
    console.log('-------------------------------------------------------------------------------')
    console.log('Servidor', server)
    console.log('-------------------------------------------------------------------------------')
    try {
      client = new Redis({
        host: server.host,
        port: server.port,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000 // Tempo limite para conexão
      });

      // Verifica se o servidor é um master
      const info = await client.info('replication');
      if (info.includes('role:master')) {
        console.log(`Master encontrado: ${server.host}:${server.port}`);
        return client; // Retorna o cliente conectado ao master
      }
      // Se não for master, desconecta e tenta o próximo
      client.disconnect();
    } catch (error) {
      console.error(`Erro ao conectar ao Redis em ${server.host}:${server.port} - ${error.message}`);
      // Passa para o próximo servidor
      if (client) {
        client.disconnect();
      }
    }
  }

  throw new Error('Nenhum servidor master encontrado');
}

// Função para desconectar do Redis
async function disconnectFromRedis(client) {
  try {
    if (client) {
      await client.quit();
      console.log("Desconectado do Redis");
    }
  } catch (error) {
    console.error("Error while disconnecting from Redis:", error.message);
  }
}

// Função para criar um servidor em uma porta específica
function createServer(port) {
  const app = express();

  app.get("/", async (req, res) => {
    let redisClient;
    try {
      // Conectar ao Redis para esta requisição
      // redisClient = await connectToRedis();
       redisClient = await getMaster(servers);
      
      const uniqueKey = uuidv4();
      const randomValue = Math.floor(Math.random() * 1000).toString(); // Garante que o valor é uma string
      // Armazena o valor com o tempo de expiração
      await redisClient.setex(`uuid:${randomValue}`, 5000, uniqueKey);

      res.send(`Valor armazenado com chave ${uniqueKey}`);
      console.log()
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
      // redisClient = await connectToRedis();
       redisClient = await getMaster(servers);
      const allData = await listAllKeysAndValues(redisClient);
      console.log("Quantidade de Dados", allData.length);
      console.log("Dados", allData);
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
createServer(3001);