// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PulseProof {
    error EmptyLabel();

    struct Pulse {
        uint256 id;
        address runner;
        string label;
        uint64 createdAt;
        uint256 observedBlock;
    }

    Pulse[] private pulses;
    mapping(address runner => uint256 count) public pulseCountByRunner;

    event PulseRecorded(
        uint256 indexed pulseId,
        address indexed runner,
        string label,
        uint256 observedBlock,
        uint64 createdAt
    );

    function runPulse(string calldata label) external returns (uint256 pulseId) {
        if (bytes(label).length == 0) revert EmptyLabel();

        pulseId = pulses.length;
        uint64 createdAt = uint64(block.timestamp);
        uint256 observedBlock = block.number;

        pulses.push(
            Pulse({
                id: pulseId,
                runner: msg.sender,
                label: label,
                createdAt: createdAt,
                observedBlock: observedBlock
            })
        );

        ++pulseCountByRunner[msg.sender];
        emit PulseRecorded(pulseId, msg.sender, label, observedBlock, createdAt);
    }

    function getPulses() external view returns (Pulse[] memory) {
        return pulses;
    }

    function getPulsesPaginated(uint256 offset, uint256 limit) external view returns (Pulse[] memory) {
        uint256 length = pulses.length;
        if (offset >= length) return new Pulse[](0);

        uint256 end = offset + limit > length ? length : offset + limit;
        uint256 size = end - offset;
        Pulse[] memory page = new Pulse[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = pulses[offset + i];
        }
        return page;
    }

    function pulseCount() external view returns (uint256) {
        return pulses.length;
    }
}
