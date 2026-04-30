import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ReputationOracle", function () {
  async function deployFixture() {
    const [owner, updater, agentA, agentB, outsider] = await ethers.getSigners();
    const reputationOracleFactory = await ethers.getContractFactory("ReputationOracle");
    const reputationOracle = await reputationOracleFactory.deploy();
    await reputationOracle.waitForDeployment();

    return { owner, updater, agentA, agentB, outsider, reputationOracle };
  }

  it("allows an authorized updater and rejects unauthorized updates", async function () {
    const { owner, updater, agentA, outsider, reputationOracle } = await loadFixture(deployFixture);

    await expect(
      reputationOracle.connect(outsider).getFunction("updateScore")(agentA.address, 9000, 9000, 9000)
    ).to.be.revertedWith("[ReputationOracle.onlyAuthorized] Unauthorized updater");

    await reputationOracle.connect(owner).getFunction("setAuthorizedUpdater")(updater.address, true);

    await expect(reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 9100, 8600, 8300)).to.emit(
      reputationOracle,
      "ScoreUpdated"
    );
  });

  it("calculates composite score and stores score fields correctly", async function () {
    const { owner, updater, agentA, reputationOracle } = await loadFixture(deployFixture);

    await reputationOracle.connect(owner).getFunction("setAuthorizedUpdater")(updater.address, true);
    const tx = await reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 8000, 7000, 6000);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const score = await reputationOracle.getFunction("getScore")(agentA.address);

    expect(score.accuracy).to.equal(8000);
    expect(score.timeliness).to.equal(7000);
    expect(score.uptime).to.equal(6000);
    expect(score.composite).to.equal(7300); // 50/30/20 weighted
    expect(score.totalJobs).to.equal(1);
    expect(score.lastUpdated).to.equal(block!.timestamp);
  });

  it("returns top agents sorted by composite score desc", async function () {
    const { owner, updater, agentA, agentB, outsider, reputationOracle } = await loadFixture(deployFixture);
    const signers = await ethers.getSigners();
    const agentC = signers[5];

    await reputationOracle.connect(owner).getFunction("setAuthorizedUpdater")(updater.address, true);

    await reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 7000, 7000, 7000); // 7000
    await reputationOracle.connect(updater).getFunction("updateScore")(agentB.address, 9000, 8000, 8000); // 8500
    await reputationOracle.connect(updater).getFunction("updateScore")(agentC.address, 5000, 9000, 9000); // 7000
    await reputationOracle.connect(updater).getFunction("updateScore")(outsider.address, 9500, 9500, 9000); // 9400

    const [topAgents, topScores] = await reputationOracle.getFunction("getTopAgents")(3);

    expect(topAgents[0]).to.equal(outsider.address);
    expect(topScores[0].composite).to.equal(9400);

    expect(topAgents[1]).to.equal(agentB.address);
    expect(topScores[1].composite).to.equal(8500);

    expect(topScores[2].composite).to.equal(7000);
  });

  it("handles edge cases: zero scores and repeated updates for same agent", async function () {
    const { owner, updater, agentA, reputationOracle } = await loadFixture(deployFixture);

    await reputationOracle.connect(owner).getFunction("setAuthorizedUpdater")(updater.address, true);

    await reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 0, 0, 0);
    let score = await reputationOracle.getFunction("getScore")(agentA.address);
    expect(score.composite).to.equal(0);
    expect(score.totalJobs).to.equal(1);

    await time.increase(5);
    await reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 10_000, 10_000, 10_000);

    score = await reputationOracle.getFunction("getScore")(agentA.address);
    expect(score.composite).to.equal(10_000);
    expect(score.totalJobs).to.equal(2);
  });

  it("caps input basis points at 10000", async function () {
    const { owner, updater, agentA, reputationOracle } = await loadFixture(deployFixture);

    await reputationOracle.connect(owner).getFunction("setAuthorizedUpdater")(updater.address, true);

    await expect(reputationOracle.connect(updater).getFunction("updateScore")(agentA.address, 10_001, 0, 0)).to.be.revertedWith(
      "[ReputationOracle.updateScore] Accuracy exceeds 10000 bps"
    );
  });
});
