import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("WorkerRegistry", function () {
  async function deployFixture() {
    const [workerA, workerB, workerC, outsider] = await ethers.getSigners();
    const workerRegistryFactory = await ethers.getContractFactory("WorkerRegistry");
    const workerRegistry = await workerRegistryFactory.deploy();
    await workerRegistry.waitForDeployment();

    return { workerA, workerB, workerC, outsider, workerRegistry };
  }

  it("registers a worker with metadata, fee, and capabilities", async function () {
    const { workerA, workerRegistry } = await loadFixture(deployFixture);
    const capabilities = ["pool-indexer", "wallet-summarizer"];

    await expect(workerRegistry.connect(workerA).getFunction("register")("zg://worker-a", 123n, capabilities))
      .to.emit(workerRegistry, "WorkerRegistered")
      .withArgs(workerA.address, "zg://worker-a");

    const worker = await workerRegistry.getFunction("getWorker")(workerA.address);
    expect(worker.wallet).to.equal(workerA.address);
    expect(worker.metadataUri).to.equal("zg://worker-a");
    expect(worker.feePerTask).to.equal(123);
    expect(worker.active).to.equal(true);
    expect(worker.capabilities).to.deep.equal(capabilities);
    expect(worker.registeredAt).to.be.greaterThan(0);
  });

  it("prevents duplicate registrations for the same address", async function () {
    const { workerA, workerRegistry } = await loadFixture(deployFixture);

    await workerRegistry.connect(workerA).getFunction("register")("zg://worker-a", 100n, ["pool-indexer"]);

    await expect(
      workerRegistry.connect(workerA).getFunction("register")("zg://worker-a-v2", 200n, ["token-fact-checker"])
    ).to.be.revertedWith("[WorkerRegistry.register] Worker already registered");
  });

  it("allows registered workers to update fee and rejects unregistered callers", async function () {
    const { workerA, outsider, workerRegistry } = await loadFixture(deployFixture);

    await workerRegistry.connect(workerA).getFunction("register")("zg://worker-a", 100n, ["pool-indexer"]);
    await workerRegistry.connect(workerA).getFunction("updateFee")(450n);

    const updated = await workerRegistry.getFunction("getWorker")(workerA.address);
    expect(updated.feePerTask).to.equal(450);

    await expect(workerRegistry.connect(outsider).getFunction("updateFee")(999n)).to.be.revertedWith(
      "[WorkerRegistry.updateFee] Worker not registered"
    );
  });

  it("deactivates a worker and excludes it from active workers", async function () {
    const { workerA, workerB, workerRegistry } = await loadFixture(deployFixture);

    await workerRegistry.connect(workerA).getFunction("register")("zg://worker-a", 100n, ["pool-indexer"]);
    await workerRegistry.connect(workerB).getFunction("register")("zg://worker-b", 200n, ["wallet-summarizer"]);

    await expect(workerRegistry.connect(workerA).getFunction("deactivate")())
      .to.emit(workerRegistry, "WorkerDeactivated")
      .withArgs(workerA.address);

    const worker = await workerRegistry.getFunction("getWorker")(workerA.address);
    expect(worker.active).to.equal(false);

    const activeWorkers = await workerRegistry.getFunction("getActiveWorkers")();
    expect(activeWorkers).to.deep.equal([workerB.address]);
  });

  it("filters workers by capability and only returns active matches", async function () {
    const { workerA, workerB, workerC, workerRegistry } = await loadFixture(deployFixture);

    await workerRegistry.connect(workerA).getFunction("register")("zg://worker-a", 100n, ["pool-indexer", "wallet-summarizer"]);
    await workerRegistry.connect(workerB).getFunction("register")("zg://worker-b", 100n, ["token-fact-checker"]);
    await workerRegistry.connect(workerC).getFunction("register")("zg://worker-c", 100n, ["pool-indexer"]);

    await workerRegistry.connect(workerC).getFunction("deactivate")();

    const poolWorkers = await workerRegistry.getFunction("getWorkersByCapability")("pool-indexer");
    expect(poolWorkers).to.deep.equal([workerA.address]);

    const tokenWorkers = await workerRegistry.getFunction("getWorkersByCapability")("token-fact-checker");
    expect(tokenWorkers).to.deep.equal([workerB.address]);

    const unknownWorkers = await workerRegistry.getFunction("getWorkersByCapability")("non-existent");
    expect(unknownWorkers).to.deep.equal([]);
  });
});
