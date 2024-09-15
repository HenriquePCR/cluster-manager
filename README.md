# Cluster Manager

**Cluster Manager** is a Node.js application designed to manage a Redis cluster with Sentinel configurations for high availability and failover support. It uses Docker Compose to orchestrate containers, including Redis instances (master-slave setup) and NGINX as a reverse proxy. The application is built with Express.js to provide REST endpoints for interacting with the Redis cluster, allowing key storage and retrieval while automatically connecting to the Redis master.

## Technologies Used

- **Docker Compose**: Orchestrates multiple containers for Redis, Sentinel, and NGINX.
- **NGINX**: Acts as a reverse proxy, managing traffic between the client and Redis instances.
- **Redis & Redis Sentinel**: Provides master-slave replication and automatic failover.
- **Express.js**: A lightweight framework for building APIs to interact with the Redis cluster.

## Features

- High availability and failover support using Redis Sentinel.
- REST endpoints for key storage and retrieval.
- Automated Redis master connection.
- Scalable architecture using Docker containers.
