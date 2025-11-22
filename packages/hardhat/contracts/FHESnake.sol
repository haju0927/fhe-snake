// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHESnake
 * @dev A private snake leaderboard where each player submits their encrypted snake length.
 * The contract only keeps the player's longest encrypted length.
 * Both the player and the contract can decrypt their own encrypted data.
 */
contract FHESnake is ZamaEthereumConfig {
    // Stores the longest encrypted length for each player
    mapping(address => euint32) private _longestSnake;
    mapping(address => bool) private _isRegistered;

    /**
     * @notice Submit your encrypted snake length after a game session.
     * @param encryptedLength Encrypted length of the snake.
     * @param zkProof Zero-knowledge proof for the encrypted input.
     */
    function updateLength(externalEuint32 encryptedLength, bytes calldata zkProof) external {
        // Convert encrypted data to internal FHE type
        euint32 currentLength = FHE.fromExternal(encryptedLength, zkProof);

        // Give access permission to both the sender and this contract
        FHE.allow(currentLength, msg.sender);
        FHE.allowThis(currentLength);

        if (_isRegistered[msg.sender]) {
            euint32 previousLongest = _longestSnake[msg.sender];

            // Compare which snake length is greater and keep the best
            euint32 bestLength = FHE.select(FHE.gt(currentLength, previousLongest), currentLength, previousLongest);

            _longestSnake[msg.sender] = bestLength;
            FHE.allow(_longestSnake[msg.sender], msg.sender);
            FHE.allowThis(_longestSnake[msg.sender]);
        } else {
            _longestSnake[msg.sender] = currentLength;
            _isRegistered[msg.sender] = true;

            FHE.allow(_longestSnake[msg.sender], msg.sender);
            FHE.allowThis(_longestSnake[msg.sender]);
        }
    }

    /**
     * @notice Retrieve the longest encrypted snake length for a given player.
     * @param player The address of the player.
     * @return The encrypted snake length.
     */
    function getLongestLength(address player) external view returns (euint32) {
        require(_isRegistered[player], "FHESnake: player has no record");
        return _longestSnake[player];
    }

    /**
     * @notice Check whether a player has submitted any encrypted snake length yet.
     * @param player The address to check.
     * @return True if the player has submitted before, false otherwise.
     */
    function hasPlayed(address player) external view returns (bool) {
        return _isRegistered[player];
    }
}
