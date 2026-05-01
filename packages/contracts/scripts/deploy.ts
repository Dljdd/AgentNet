import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "OG");

  if (balance === 0n) {
    throw new Error("Deployer has zero balance — fund your wallet first from the 0G testnet faucet");
  }

  // Deploy ReputationOracle
  console.log("\nDeploying ReputationOracle...");
  const ReputationOracle = await ethers.getContractFactory("ReputationOracle");
  const reputationOracle = await ReputationOracle.deploy();
  await reputationOracle.waitForDeployment();
  const reputationOracleAddress = await reputationOracle.getAddress();
  console.log("ReputationOracle deployed to:", reputationOracleAddress);

  // Deploy WorkerRegistry
  console.log("\nDeploying WorkerRegistry...");
  const WorkerRegistry = await ethers.getContractFactory("WorkerRegistry");
  const workerRegistry = await WorkerRegistry.deploy();
  await workerRegistry.waitForDeployment();
  const workerRegistryAddress = await workerRegistry.getAddress();
  console.log("WorkerRegistry deployed to:", workerRegistryAddress);

  // Update .env file with deployed addresses
  const envPath = path.resolve(__dirname, "../../../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  // Replace or append REPUTATION_ORACLE_ADDRESS
  if (envContent.includes("REPUTATION_ORACLE_ADDRESS=")) {
    envContent = envContent.replace(
      /REPUTATION_ORACLE_ADDRESS=.*/,
      `REPUTATION_ORACLE_ADDRESS=${reputationOracleAddress}`
    );
  } else {
    envContent += `\nREPUTATION_ORACLE_ADDRESS=${reputationOracleAddress}`;
  }

  // Replace or append WORKER_REGISTRY_ADDRESS
  if (envContent.includes("WORKER_REGISTRY_ADDRESS=")) {
    envContent = envContent.replace(
      /WORKER_REGISTRY_ADDRESS=.*/,
      `WORKER_REGISTRY_ADDRESS=${workerRegistryAddress}`
    );
  } else {
    envContent += `\nWORKER_REGISTRY_ADDRESS=${workerRegistryAddress}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("\n✅ .env updated with contract addresses");

  // Also write to a deployment artifact for reference
  const artifact = {
    network: "0g-testnet",
    chainId: 16600,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ReputationOracle: reputationOracleAddress,
      WorkerRegistry: workerRegistryAddress,
    },
  };
  const artifactPath = path.resolve(__dirname, "../deployments.json");
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log("Deployment artifact written to packages/contracts/deployments.json");

  console.log("\n=== Deployment Summary ===");
  console.log(`ReputationOracle : ${reputationOracleAddress}`);
  console.log(`WorkerRegistry   : ${workerRegistryAddress}`);
  console.log(`Explorer         : https://chainscan-testnet.0g.ai/address/${reputationOracleAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
