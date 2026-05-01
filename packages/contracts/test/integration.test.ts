import { ethers } from "hardhat";
import { expect } from "chai";

describe("ReputationOracle", () => {
  it("deploys and sets deployer as authorized updater", async () => {
    const [owner] = await ethers.getSigners();
    const ReputationOracle = await ethers.getContractFactory("ReputationOracle");
    const oracle = await ReputationOracle.deploy();
    expect(await oracle.authorizedUpdaters(owner.address)).to.equal(true);
  });

  it("allows authorized updater to write and read a score", async () => {
    const [owner] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("ReputationOracle")).deploy();
    const agent = ethers.Wallet.createRandom().address;

    await oracle.updateScore(agent, 8500, 7800, 9200);
    const score = await oracle.getScore(agent);

    expect(score.accuracy).to.equal(8500n);
    expect(score.timeliness).to.equal(7800n);
    expect(score.uptime).to.equal(9200n);
    // composite = (8500*50 + 7800*30 + 9200*20) / 100 = 8430
    expect(score.composite).to.equal(8430n);
    expect(score.totalJobs).to.equal(1n);
  });

  it("rejects scores above 10000 bps", async () => {
    const oracle = await (await ethers.getContractFactory("ReputationOracle")).deploy();
    const agent = ethers.Wallet.createRandom().address;
    await expect(oracle.updateScore(agent, 10001, 5000, 5000)).to.be.revertedWith(
      "[ReputationOracle.updateScore] Accuracy exceeds 10000 bps"
    );
  });

  it("rejects unauthorized updater", async () => {
    const [, stranger] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("ReputationOracle")).deploy();
    const agent = ethers.Wallet.createRandom().address;
    await expect(oracle.connect(stranger).updateScore(agent, 5000, 5000, 5000)).to.be.revertedWith(
      "[ReputationOracle.onlyAuthorized] Unauthorized updater"
    );
  });

  it("getTopAgents returns correct ranking", async () => {
    const oracle = await (await ethers.getContractFactory("ReputationOracle")).deploy();
    const agents = [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ];
    await oracle.updateScore(agents[0], 5000, 5000, 5000);
    await oracle.updateScore(agents[1], 9000, 9000, 9000);
    await oracle.updateScore(agents[2], 2000, 2000, 2000);

    const [topAddrs] = await oracle.getTopAgents(2);
    expect(topAddrs[0]).to.equal(agents[1]); // highest
    expect(topAddrs[1]).to.equal(agents[0]); // second
  });
});

describe("WorkerRegistry", () => {
  it("registers a worker and retrieves it", async () => {
    const [owner] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("WorkerRegistry")).deploy();

    await registry.register("ipfs://metadata", 10_000_000_000_000_000n, ["pool-indexer"]);

    expect(await registry.isRegistered(owner.address)).to.equal(true);
    const worker = await registry.getWorker(owner.address);
    expect(worker.feePerTask).to.equal(10_000_000_000_000_000n);
    expect(worker.active).to.equal(true);
  });

  it("prevents double registration", async () => {
    const registry = await (await ethers.getContractFactory("WorkerRegistry")).deploy();
    await registry.register("ipfs://metadata", 1000n, ["pool-indexer"]);
    await expect(registry.register("ipfs://metadata2", 2000n, ["wallet-summarizer"])).to.be.revertedWith(
      "[WorkerRegistry.register] Worker already registered"
    );
  });

  it("deactivates a worker", async () => {
    const registry = await (await ethers.getContractFactory("WorkerRegistry")).deploy();
    await registry.register("ipfs://metadata", 1000n, ["pool-indexer"]);
    await registry.deactivate();
    const worker = await registry.getWorker((await ethers.getSigners())[0].address);
    expect(worker.active).to.equal(false);
  });

  it("getWorkersByCapability filters correctly", async () => {
    const [a, b] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("WorkerRegistry")).deploy();
    await registry.connect(a).register("ipfs://a", 1000n, ["pool-indexer"]);
    await registry.connect(b).register("ipfs://b", 1000n, ["wallet-summarizer"]);

    const poolWorkers = await registry.getWorkersByCapability("pool-indexer");
    expect(poolWorkers).to.include(a.address);
    expect(poolWorkers).to.not.include(b.address);
  });
});
