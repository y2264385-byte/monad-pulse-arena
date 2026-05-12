// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BlitzBoard {
    error EmptyName();
    error EmptyPitch();
    error ProjectNotFound();
    error AlreadyVoted();

    struct Project {
        uint256 id;
        address creator;
        string name;
        string pitch;
        uint256 votes;
        uint64 createdAt;
    }

    Project[] private projects;
    mapping(address voter => bool hasVoted) public hasVoted;

    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed creator,
        string name,
        string pitch
    );
    event Voted(uint256 indexed projectId, address indexed voter, uint256 votes);

    function registerProject(string calldata name, string calldata pitch) external returns (uint256 projectId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(pitch).length == 0) revert EmptyPitch();

        projectId = projects.length;
        projects.push(
            Project({
                id: projectId,
                creator: msg.sender,
                name: name,
                pitch: pitch,
                votes: 0,
                createdAt: uint64(block.timestamp)
            })
        );

        emit ProjectRegistered(projectId, msg.sender, name, pitch);
    }

    function vote(uint256 projectId) external {
        if (projectId >= projects.length) revert ProjectNotFound();
        if (hasVoted[msg.sender]) revert AlreadyVoted();

        hasVoted[msg.sender] = true;
        uint256 votes = ++projects[projectId].votes;

        emit Voted(projectId, msg.sender, votes);
    }

    function getProjects() external view returns (Project[] memory) {
        return projects;
    }

    function projectCount() external view returns (uint256) {
        return projects.length;
    }
}
