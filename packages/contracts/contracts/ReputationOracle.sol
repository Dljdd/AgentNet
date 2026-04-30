// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationOracle
 * @notice Stores and exposes on-chain reputation scores for worker agents.
 */
contract ReputationOracle is Ownable {
    uint256 private constant MAX_BPS = 10_000;

    struct AgentScore {
        uint256 accuracy;
        uint256 timeliness;
        uint256 uptime;
        uint256 composite;
        uint256 totalJobs;
        uint256 lastUpdated;
    }

    mapping(address => AgentScore) private agentScores;
    mapping(address => bool) public authorizedUpdaters;
    address[] private knownAgents;
    mapping(address => bool) private isKnownAgent;

    event ScoreUpdated(address indexed agent, uint256 composite, uint256 timestamp);

    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender], "[ReputationOracle.onlyAuthorized] Unauthorized updater");
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedUpdaters[msg.sender] = true;
    }

    /**
     * @notice Authorizes or deauthorizes an updater address.
     * @param updater The address to update authorization for.
     * @param authorized Whether the address is authorized.
     */
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        require(updater != address(0), "[ReputationOracle.setAuthorizedUpdater] Updater cannot be zero address");
        authorizedUpdaters[updater] = authorized;
    }

    /**
     * @notice Updates an agent's score dimensions and recalculates its composite score.
     * @param agent Agent wallet address.
     * @param accuracy Accuracy score in basis points (0-10000).
     * @param timeliness Timeliness score in basis points (0-10000).
     * @param uptime Uptime score in basis points (0-10000).
     */
    function updateScore(address agent, uint256 accuracy, uint256 timeliness, uint256 uptime) external onlyAuthorized {
        require(agent != address(0), "[ReputationOracle.updateScore] Agent cannot be zero address");
        require(accuracy <= MAX_BPS, "[ReputationOracle.updateScore] Accuracy exceeds 10000 bps");
        require(timeliness <= MAX_BPS, "[ReputationOracle.updateScore] Timeliness exceeds 10000 bps");
        require(uptime <= MAX_BPS, "[ReputationOracle.updateScore] Uptime exceeds 10000 bps");

        uint256 composite = ((accuracy * 50) + (timeliness * 30) + (uptime * 20)) / 100;

        AgentScore storage current = agentScores[agent];
        current.accuracy = accuracy;
        current.timeliness = timeliness;
        current.uptime = uptime;
        current.composite = composite;
        current.totalJobs += 1;
        current.lastUpdated = block.timestamp;

        if (!isKnownAgent[agent]) {
            isKnownAgent[agent] = true;
            knownAgents.push(agent);
        }

        emit ScoreUpdated(agent, composite, block.timestamp);
    }

    /**
     * @notice Returns an agent's full score struct.
     * @param agent Agent wallet address.
     */
    function getScore(address agent) external view returns (AgentScore memory) {
        return agentScores[agent];
    }

    /**
     * @notice Returns top agents sorted by composite score descending.
     * @dev Uses insertion into a bounded in-memory array; intended for small N.
     * @param count Number of top agents to return.
     */
    function getTopAgents(uint256 count) external view returns (address[] memory, AgentScore[] memory) {
        uint256 totalAgents = knownAgents.length;
        if (count > totalAgents) {
            count = totalAgents;
        }

        address[] memory topAgents = new address[](count);
        AgentScore[] memory topScores = new AgentScore[](count);

        if (count == 0) {
            return (topAgents, topScores);
        }

        for (uint256 i = 0; i < totalAgents; i++) {
            address candidateAgent = knownAgents[i];
            AgentScore memory candidateScore = agentScores[candidateAgent];

            for (uint256 j = 0; j < count; j++) {
                bool shouldInsert = topAgents[j] == address(0) || candidateScore.composite > topScores[j].composite;

                if (shouldInsert) {
                    for (uint256 k = count - 1; k > j; k--) {
                        topAgents[k] = topAgents[k - 1];
                        topScores[k] = topScores[k - 1];
                    }

                    topAgents[j] = candidateAgent;
                    topScores[j] = candidateScore;
                    break;
                }
            }
        }

        return (topAgents, topScores);
    }
}
