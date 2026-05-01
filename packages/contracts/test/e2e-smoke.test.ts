import { ethers } from "hardhat";
import { expect } from "chai";

describe("AgentNet E2E Smoke Test", () => {
  it("full flow: register worker → update score → query top agents", async () => {
    const [deployer, worker1, worker2] = await ethers.getSigners();

    // Deploy
    const oracle = await (await ethers.getContractFactory("ReputationOracle")).deploy();
    const registry = await (await ethers.getContractFactory("WorkerRegistry")).deploy();

    // Authorize deployer as updater (already done in constructor, verify)
    expect(await oracle.authorizedUpdaters(deployer.address)).to.equal(true);

    // Register 2 workers
    await registry.connect(worker1).register(
      "ipfs://worker1", 10_000_000_000_000_000n, ["pool-indexer", "wallet-summarizer"]
    );
    await registry.connect(worker2).register(
      "ipfs://worker2", 5_000_000_000_000_000n, ["token-fact-checker"]
    );

    // Verify both active
    const activeWorkers = await registry.getActiveWorkers();
    expect(activeWorkers.length).to.equal(2);

    // Score both workers
    await oracle.updateScore(worker1.address, 9000, 8500, 9200);
    await oracle.updateScore(worker2.address, 4500, 5000, 6000);

    // Verify scores
    const score1 = await oracle.getScore(worker1.address);
    const score2 = await oracle.getScore(worker2.address);
    expect(score1.composite).to.be.greaterThan(score2.composite);

    // Top agents returns worker1 first
    const [topAddrs, topScores] = await oracle.getTopAgents(2);
    expect(topAddrs[0]).to.equal(worker1.address);
    expect(topScores[0].composite).to.equal(score1.composite);

    // Deactivate worker2
    await registry.connect(worker2).deactivate();
    const activeAfter = await registry.getActiveWorkers();
    expect(activeAfter.length).to.equal(1);
    expect(activeAfter[0]).to.equal(worker1.address);

    // Authorize a new updater (simulating ReputationAgent address)
    const repAgentWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    await oracle.setAuthorizedUpdater(repAgentWallet.address, true);
    expect(await oracle.authorizedUpdaters(repAgentWallet.address)).to.equal(true);

    console.log("\n✅ E2E smoke test passed:");
    console.log(`   ReputationOracle: ${await oracle.getAddress()}`);
    console.log(`   WorkerRegistry:   ${await registry.getAddress()}`);
    console.log(`   Worker1 composite: ${score1.composite}`);
    console.log(`   Worker2 composite: ${score2.composite}`);
  });
});
