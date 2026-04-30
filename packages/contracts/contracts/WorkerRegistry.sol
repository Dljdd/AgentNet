// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WorkerRegistry
 * @notice On-chain registry for worker agent discovery and metadata.
 */
contract WorkerRegistry {
    struct WorkerInfo {
        address wallet;
        string metadataUri;
        uint256 feePerTask;
        string[] capabilities;
        bool active;
        uint256 registeredAt;
    }

    mapping(address => WorkerInfo) private workers;
    mapping(address => bool) public isRegistered;
    address[] private workerAddresses;

    event WorkerRegistered(address indexed wallet, string metadataUri);
    event WorkerDeactivated(address indexed wallet);

    /**
     * @notice Registers the caller as a worker.
     * @param metadataUri URI pointing to off-chain profile metadata.
     * @param feePerTask Fee charged by the worker per task in wei.
     * @param capabilities Worker capability tags.
     */
    function register(string calldata metadataUri, uint256 feePerTask, string[] calldata capabilities) external {
        require(!isRegistered[msg.sender], "[WorkerRegistry.register] Worker already registered");
        require(bytes(metadataUri).length > 0, "[WorkerRegistry.register] metadataUri cannot be empty");

        WorkerInfo storage worker = workers[msg.sender];
        worker.wallet = msg.sender;
        worker.metadataUri = metadataUri;
        worker.feePerTask = feePerTask;
        worker.active = true;
        worker.registeredAt = block.timestamp;

        delete worker.capabilities;
        for (uint256 i = 0; i < capabilities.length; i++) {
            worker.capabilities.push(capabilities[i]);
        }

        isRegistered[msg.sender] = true;
        workerAddresses.push(msg.sender);

        emit WorkerRegistered(msg.sender, metadataUri);
    }

    /**
     * @notice Updates the caller's fee.
     * @param newFee The new fee in wei.
     */
    function updateFee(uint256 newFee) external {
        require(isRegistered[msg.sender], "[WorkerRegistry.updateFee] Worker not registered");
        workers[msg.sender].feePerTask = newFee;
    }

    /**
     * @notice Deactivates the caller's worker profile.
     */
    function deactivate() external {
        require(isRegistered[msg.sender], "[WorkerRegistry.deactivate] Worker not registered");
        require(workers[msg.sender].active, "[WorkerRegistry.deactivate] Worker already inactive");

        workers[msg.sender].active = false;

        emit WorkerDeactivated(msg.sender);
    }

    /**
     * @notice Returns worker details for a wallet.
     * @param wallet Worker wallet address.
     */
    function getWorker(address wallet) external view returns (WorkerInfo memory) {
        return workers[wallet];
    }

    /**
     * @notice Returns all active worker addresses.
     */
    function getActiveWorkers() external view returns (address[] memory) {
        uint256 activeCount;

        for (uint256 i = 0; i < workerAddresses.length; i++) {
            if (workers[workerAddresses[i]].active) {
                activeCount++;
            }
        }

        address[] memory activeWorkers = new address[](activeCount);
        uint256 index;

        for (uint256 i = 0; i < workerAddresses.length; i++) {
            address workerAddress = workerAddresses[i];
            if (workers[workerAddress].active) {
                activeWorkers[index] = workerAddress;
                index++;
            }
        }

        return activeWorkers;
    }

    /**
     * @notice Returns active workers that advertise a specific capability.
     * @param capability Capability to filter by.
     */
    function getWorkersByCapability(string calldata capability) external view returns (address[] memory) {
        uint256 matchingCount;

        for (uint256 i = 0; i < workerAddresses.length; i++) {
            address workerAddress = workerAddresses[i];
            if (workers[workerAddress].active && _hasCapability(workers[workerAddress], capability)) {
                matchingCount++;
            }
        }

        address[] memory matchingWorkers = new address[](matchingCount);
        uint256 index;

        for (uint256 i = 0; i < workerAddresses.length; i++) {
            address workerAddress = workerAddresses[i];
            if (workers[workerAddress].active && _hasCapability(workers[workerAddress], capability)) {
                matchingWorkers[index] = workerAddress;
                index++;
            }
        }

        return matchingWorkers;
    }

    function _hasCapability(WorkerInfo storage worker, string memory capability) internal view returns (bool) {
        bytes32 sought = keccak256(bytes(capability));
        for (uint256 i = 0; i < worker.capabilities.length; i++) {
            if (keccak256(bytes(worker.capabilities[i])) == sought) {
                return true;
            }
        }

        return false;
    }
}
