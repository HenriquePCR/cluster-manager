/*

docker run -d --name redis-master --network my-network redis redis-server --port 6379 --bind 0.0.0.0 --protected-mode no

docker run -d --name redis-slave --network my-network redis redis-server --port 6379 --bind 0.0.0.0 --protected-mode no --replicaof redis-master 6379

docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' redis-master

docker run -d --name redis-sentinel1 --network my-network -v "C:/Users/vitor/Documents/Cefet/9 periodo/trab sd/sentinel.conf:/usr/local/etc/redis/sentinel.conf" redis redis-sentinel /usr/local/etc/redis/sentinel.conf

docker run -d --name redis-sentinel2 --network my-network -v "C:/Users/vitor/Documents/Cefet/9 periodo/trab sd/sentinel.conf:/usr/local/etc/redis/sentinel.conf" redis redis-sentinel /usr/local/etc/redis/sentinel.conf

docker run -d --name redis-sentinel3 --network my-network -v "C:/Users/vitor/Documents/Cefet/9 periodo/trab sd/sentinel.conf:/usr/local/etc/redis/sentinel.conf" redis redis-sentinel /usr/local/etc/redis/sentinel.conf

curl http://localhost:3000/list-keys

for ($i=0; $i -lt 50; $i++) { curl http://localhost:3000; Start-Sleep -Seconds 5 }

Verificar sentinel.conf

docker exec -it redis-sentinel bash
cat /usr/local/etc/redis/sentinel.conf

Ver logs docker

docker logs redis-sentinel

importante ver o ip

docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' redis-slave1

*/

//  redis-server --port 6380
// redis-server --port 6381 --slaveof 127.0.0.1 6380

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const redis = require("redis");
const Redis = require("ioredis");

// async function connectToRedis() {
//   const client = redis.createClient({
//     url: 'redis://127.0.0.1:6379', // Ajuste a URL conforme necessário
//     // password: 'yourpassword', // Adicione a senha se necessário
//   });

//   client.on('error', (err) => {
//     console.error('Erro ao conectar ao Redis:', err);
//   });

//   await client.connect();

//   return client;
// }

const servers = [
  { host: '127.0.0.1', port: 6379, name: 'redis-master' }, // Exemplo do master
  { host: '127.0.0.1', port: 6380, name: 'redis-slave1' }, // Exemplo do slave 1
  { host: '127.0.0.1', port: 6381, name: 'redis-slave2' }  // Exemplo do slave 2
];

const checkMasterStatus = async (client) => {
  try {
    const info = await client.info('replication');
    console.log('info',info)
    return info.includes('role:master');
  } catch (error) {
    console.error('Erro ao verificar o status do master:', error);
    return false;
  }
};

async function getMaster(servers) {
  for (const server of servers) {
    let client;

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

async function connectToRedis2() {
  // Defina os sentinelas com IPs da rede Docker, se aplicável
  // const sentinels = [
  //   { host: "redis-sentinel1", port: 5000 },
  //   { host: 'redis-sentinel2', port: 5001 },
  //   { host: 'redis-sentinel3', port: 5002 }
  // ];
  // const sentinelClient = new Redis({
  //   sentinels: sentinels,
  //   name: "mymaster", // Nome do mestre configurado no Sentinel
  // });

  // Conecte-se ao mestre através dos sentinelas
  const redisClient = new Redis({
    host: "172.18.0.2",
    name: "mymaster",
    connectTimeout: 10000,
  });

  console.log('redisClient',redisClient)

  // const masterInfo = await sentinelClient.sentinel("get-master-addr-by-name", "mymaster");

  redisClient.on("error", (err) => {
    console.error("Erro ao conectar ao Redis:", err);
  });

  redisClient.on("ready", () => {
    console.log("Conexão com o Redis estabelecida com sucesso!");
  });

  return redisClient;
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
      // redisClient = await connectToRedis();
       redisClient = await getMaster(servers);

      const uniqueKey = `Henrique:${uuidv4()}`;
      const randomValue = Math.floor(Math.random() * 1000).toString(); // Garante que o valor é uma string
      await redisClient.setex(uniqueKey, 1000, `Value: ${randomValue}, Stored in: Banco 1`);
      // Usar o método set com tempo de expiração
      // await redisClient.set("foo", "bar");

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
      // redisClient = await connectToRedis();
       redisClient = await getMaster(servers);
      const allData = await listAllKeysAndValues(redisClient);
      console.log("allData", allData);
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
